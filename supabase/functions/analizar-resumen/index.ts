// Lee un resumen de tarjeta o de cuenta bancaria (PDF, o CSV/Excel convertido
// a texto en el navegador) con IA y devuelve como JSON estructurado la cabecera
// (saldos, vencimientos, tasas, cuotas a vencer, planes, avisos) y los
// renglones. No guarda nada: la app recibe el resultado, lo muestra y lo guarda
// con la sesión del usuario (RLS).
//
// Proveedor de IA: usa Gemini si hay `gemini_api_key` en app_secrets; si no,
// Claude (`anthropic_api_key`). app_secrets solo la puede leer el service role:
//   insert into app_secrets (key, value) values ('gemini_api_key', '...');
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { extraerConGemini, ProviderError } from "./gemini.ts";

const MODEL_CLAUDE = "claude-opus-5-5";
const MODEL_GEMINI = "gemini-3.8-flash";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface Payload {
  archivo: { nombre: string; tipo: "pdf" | "texto"; data: string };
  categorias?: { id: string; nombre: string }[];
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const num = (description?: string) => nullable(description ? { type: "number", description } : { type: "number" });
const fecha = (description: string) => nullable({ type: "string", description: `${description} (YYYY-MM-DD)` });

// Datos de cabecera y condiciones del resumen (todo opcional: cada banco trae distintos)
const DETALLE = {
  type: "object",
  additionalProperties: false,
  required: [
    "producto", "fecha_cierre", "fecha_vencimiento", "proximo_cierre", "proximo_vencimiento",
    "saldo_anterior_ars", "saldo_anterior_usd", "saldo_actual_ars", "saldo_actual_usd", "pago_minimo",
    "limite_compra", "limite_financiacion", "limite_adelanto", "limite_cuotas",
    "tna", "tem", "tea", "cftea", "tipo_cambio",
    "cuotas_a_vencer", "saldo_financiable", "planes_ofrecidos", "avisos",
  ],
  properties: {
    producto: nullable({ type: "string", description: "Producto, p. ej. 'Visa Signature' o 'Caja de ahorro en pesos'" }),
    fecha_cierre: fecha("Cierre actual"),
    fecha_vencimiento: fecha("Vencimiento actual"),
    proximo_cierre: fecha("Próximo cierre"),
    proximo_vencimiento: fecha("Próximo vencimiento"),
    saldo_anterior_ars: num(), saldo_anterior_usd: num(),
    saldo_actual_ars: num("Saldo actual / total a pagar en pesos"), saldo_actual_usd: num("Saldo actual en dólares"),
    pago_minimo: num(),
    limite_compra: num(), limite_financiacion: num(), limite_adelanto: num(), limite_cuotas: num(),
    tna: num("TNA en pesos, en porcentaje (72,970 % → 72.97)"),
    tem: num("TEM en pesos, en porcentaje"),
    tea: num("TEA en pesos, en porcentaje"),
    cftea: num("CFTEA con IVA en pesos, en porcentaje"),
    tipo_cambio: num("Tipo de cambio usado en el resumen (p. ej. 'TC1535,000' → 1535)"),
    cuotas_a_vencer: {
      type: "array",
      description: "Tabla del banco con el total de cuotas que vencen en cada mes",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["mes", "monto", "desde"],
        properties: {
          mes: { type: "string", description: "YYYY-MM" },
          monto: { type: "number" },
          desde: { type: "boolean", description: "true si es un acumulado 'a partir de' ese mes" },
        },
      },
    },
    saldo_financiable: num("Saldo que el banco ofrece refinanciar en cuotas"),
    planes_ofrecidos: {
      type: "array",
      description: "Opciones de refinanciación que ofrece el banco (p. ej. Plan V)",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["cuotas", "monto_cuota", "tna", "cftea"],
        properties: {
          cuotas: { type: "integer" }, monto_cuota: { type: "number" }, tna: num(), cftea: num(),
        },
      },
    },
    avisos: {
      type: "array",
      description: "Cambios de comisiones, tasas, beneficios o condiciones informados en el resumen o sus cartas",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "texto", "vigencia", "monto"],
        properties: {
          tipo: { type: "string", enum: ["comision", "tasa", "beneficio", "condicion", "otro"] },
          texto: { type: "string", description: "Resumen breve en una oración (máx. 200 caracteres)" },
          vigencia: fecha("Desde cuándo rige"),
          monto: num("Monto asociado, si lo hay (p. ej. comisión mensual de este producto)"),
        },
      },
    },
  },
};

// Esquema de salida (structured outputs: la respuesta siempre valida contra esto)
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["emisor", "tipo", "periodo", "moneda", "total", "detalle", "items"],
  properties: {
    emisor: { type: "string", description: "Banco y producto, p. ej. 'BBVA Visa' o 'Galicia Caja de ahorro'" },
    tipo: { type: "string", enum: ["tarjeta", "cuenta"] },
    periodo: { type: "string", description: "Mes del cierre del resumen, formato YYYY-MM (si el cierre cae entre el 1 y el 7, el mes anterior)" },
    moneda: { type: "string", enum: ["ARS", "USD", "COP"], description: "Moneda principal del resumen" },
    total: nullable({ type: "number" }),
    detalle: DETALLE,
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fecha", "descripcion", "comercio", "monto", "moneda", "cuota_actual", "cuota_total", "tipo", "categoria", "titular"],
        properties: {
          fecha: { type: "string", description: "YYYY-MM-DD" },
          descripcion: { type: "string", description: "Texto tal como figura en el resumen" },
          comercio: { type: "string", description: "Nombre limpio y estable del comercio o concepto (sin números de operación ni cuotas)" },
          monto: { type: "number", description: "Positivo = gasto/débito; negativo = pago, devolución o crédito" },
          moneda: { type: "string", enum: ["ARS", "USD", "COP"] },
          cuota_actual: nullable({ type: "integer" }),
          cuota_total: nullable({ type: "integer" }),
          tipo: {
            type: "string",
            enum: [
              "consumo", "debito_automatico", "pago", "impuesto", "percepcion", "interes", "comision",
              "financiacion", "devolucion", "transferencia", "ajuste", "otro",
            ],
          },
          categoria: nullable({ type: "string", description: "id de la lista de categorías, o null si ninguna aplica" }),
          titular: nullable({ type: "string", description: "Titular o adicional de la sección (p. ej. 'Consumos Ana Pérez' → 'Ana Pérez')" }),
        },
      },
    },
  },
};

const SYSTEM = `Extraés toda la información útil de resúmenes de tarjetas de crédito y de cuentas bancarias (Argentina y Colombia).

Renglones (items):
- Incluí cada movimiento con importe UNA sola vez. Muchos resúmenes repiten los pagos y ajustes en un cuadro inicial y en el detalle: no los dupliques. No incluyas subtotales ("TOTAL CONSUMOS…"), saldos ni el total a pagar.
- Montos con signo: positivo = gasto o débito; negativo = pago, devolución, bonificación o crédito.
- Formatos locales: "1.234,56" es mil doscientos treinta y cuatro con cincuenta y seis. Fechas "dd-Mmm-aa" o "dd/mm": completá el año según el período (si el mes es posterior al cierre, es del año anterior). Las compras en cuotas pueden tener fecha de meses anteriores: respetala.
- Consumos en dólares van con moneda USD aunque el resumen sea en pesos.
- Cuotas: "C.03/12", "Cuota 3 de 12" o "1-12" → cuota_actual 3, cuota_total 12; el monto es el de la cuota de este resumen.
- tipo:
  · consumo: compras (incluidas las cuotas de compras y las propinas).
  · debito_automatico: servicios adheridos al débito automático.
  · pago: pagos del resumen.
  · impuesto: IVA (incluido el IVA sobre intereses o planes), sellos, IIBB.
  · percepcion: percepciones a cuenta de Ganancias / Bienes Personales sobre consumos en moneda extranjera (RG 5617, RG 4815…); su devolución o crédito va con monto negativo.
  · interes: intereses de financiación o punitorios.
  · comision: mantenimiento, renovación, reposición, etc.
  · financiacion: cuotas de refinanciación del saldo o planes de pago ("FINANC DE SALDO", "PLAN V"…); el crédito que pasa el saldo al plan ("CR.$ PLAN V") va con monto negativo.
  · ajuste: transferencias de deuda entre monedas, redondeos.
  · devolucion, transferencia, otro: según corresponda.
- "comercio": nombre corto y estable para agrupar entre meses (p. ej. "NETFLIX.COM 1234" → "Netflix", "MERPAGO*CAFEMARTINEZ" → "Café Martínez", "PROPINA*RAPPI" → "Rappi (propina)", "PAYU*AR*UBER" → "Uber").
- "categoria": elegí el id más adecuado de la lista provista; null si no hay uno razonable (impuestos, pagos y ajustes van con null).
- "titular": nombre del titular o adicional cuando el resumen separa los consumos por persona; null si no aplica.

Cabecera (detalle):
- Completá todo lo que figure: fechas de cierre y vencimiento (actuales y próximas), saldos en pesos y dólares, pago mínimo, límites, tasas (TNA, TEM, TEA, CFTEA con IVA, como porcentaje), tipo de cambio, el cuadro "Total de cuotas a vencer" (incluido el acumulado "A partir de…", con desde = true), el saldo financiable y los planes de refinanciación ofrecidos.
- avisos: solo cambios concretos que afectan al cliente (nuevas comisiones del producto de este resumen, cambios de tasas, beneficios que se pierden o ganan) con su fecha de vigencia y monto. Ignorá el texto legal genérico y las tablas comparativas de otros bancos.
- Lo que no figure va en null (o lista vacía).

"total": total a pagar (tarjeta) o null si no figura.`;

async function extraerConClaude(apiKey: string, archivo: Payload["archivo"], instruccion: string) {
  const client = new Anthropic({ apiKey });
  const content: Anthropic.Beta.BetaContentBlockParam[] = archivo.tipo === "pdf"
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.data } },
        { type: "text", text: instruccion },
      ]
    : [{ type: "text", text: `<resumen>\n${archivo.data}\n</resumen>\n\n${instruccion}` }];

  const stream = client.beta.messages.stream({
    model: MODEL_CLAUDE,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new ProviderError("el modelo no pudo procesar este archivo", 422);
  if (msg.stop_reason === "max_tokens") throw new ProviderError("el resumen es demasiado largo para procesarlo de una vez", 422);

  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return json({
    resultado: JSON.parse(text),
    uso: { modelo: msg.model, entrada: msg.usage.input_tokens, salida: msg.usage.output_tokens },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  // Solo usuarios habilitados (misma regla que RLS)
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: allowed } = await asUser.rpc("is_allowed_user");
  if (allowed !== true) return json({ error: "no autorizado" }, 403);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "cuerpo inválido" }, 400);
  }
  const { archivo, categorias = [] } = body;
  if (!archivo?.data || (archivo.tipo !== "pdf" && archivo.tipo !== "texto")) {
    return json({ error: "falta el archivo" }, 400);
  }
  if (archivo.data.length > 20_000_000) return json({ error: "archivo demasiado grande (máx. ~15 MB)" }, 413);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secrets } = await admin.from("app_secrets").select("key, value").in("key", ["gemini_api_key", "anthropic_api_key"]);
  const geminiKey = secrets?.find((r: { key: string }) => r.key === "gemini_api_key")?.value;
  const claudeKey = secrets?.find((r: { key: string }) => r.key === "anthropic_api_key")?.value;
  if (!geminiKey && !claudeKey) {
    return json({ error: "falta configurar gemini_api_key (o anthropic_api_key) en app_secrets" }, 500);
  }

  const listaCategorias = categorias.map((c) => `${c.id} = ${c.nombre}`).join("\n");
  const instruccion = `Archivo: ${archivo.nombre}\n\nCategorías disponibles (id = nombre):\n${listaCategorias || "(ninguna)"}\n\nExtraé la cabecera y todos los movimientos de este resumen.`;

  try {
    if (geminiKey) {
      const r = await extraerConGemini({
        apiKey: geminiKey, model: MODEL_GEMINI, system: SYSTEM, schema: SCHEMA, archivo, instruccion,
      });
      return json(r);
    }
    return await extraerConClaude(claudeKey!, archivo, instruccion);
  } catch (err) {
    if (err instanceof ProviderError) return json({ error: err.message }, err.status);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "límite de uso de la API, intente de nuevo en un minuto" }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "la clave de la API de Claude no es válida" }, 500);
    if (err instanceof Anthropic.BadRequestError) return json({ error: `la API rechazó el archivo: ${err.message}` }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: `error de la API (${err.status})` }, 502);
    console.error("[analizar-resumen]", err);
    return json({ error: "no se pudo leer el resumen" }, 500);
  }
});
