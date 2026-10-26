// Lee un resumen de tarjeta o de cuenta bancaria (PDF, o CSV/Excel convertido
// a texto en el navegador) con la API de Claude y devuelve sus renglones como
// JSON estructurado. No guarda nada: la app recibe el resultado, lo muestra y
// lo guarda con la sesión del usuario (RLS).
//
// Requiere la clave en app_secrets (solo service role puede leerla):
//   insert into app_secrets (key, value) values ('anthropic_api_key', 'sk-ant-...');
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";

const MODEL = "claude-opus-5-5";

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

// Esquema de salida (structured outputs: la respuesta siempre valida contra esto)
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["emisor", "tipo", "periodo", "moneda", "total", "items"],
  properties: {
    emisor: { type: "string", description: "Banco y producto, p. ej. 'BBVA Visa' o 'Galicia Caja de ahorro'" },
    tipo: { type: "string", enum: ["tarjeta", "cuenta"] },
    periodo: { type: "string", description: "Mes del cierre del resumen, formato YYYY-MM" },
    moneda: { type: "string", enum: ["ARS", "USD", "COP"], description: "Moneda principal del resumen" },
    total: nullable({ type: "number" }),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fecha", "descripcion", "comercio", "monto", "moneda", "cuota_actual", "cuota_total", "tipo", "categoria"],
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
            enum: ["consumo", "debito_automatico", "pago", "impuesto", "interes", "comision", "devolucion", "transferencia", "otro"],
          },
          categoria: nullable({ type: "string", description: "id de la lista de categorías, o null si ninguna aplica" }),
        },
      },
    },
  },
};

const SYSTEM = `Extraés los movimientos de resúmenes de tarjetas de crédito y de cuentas bancarias (Argentina y Colombia).
Reglas:
- Incluí cada renglón con importe: consumos, cuotas, débitos automáticos, impuestos (IVA, sellos, percepciones), intereses, comisiones, pagos y devoluciones. No incluyas subtotales, saldos ni el total a pagar como renglones.
- Montos con signo: positivo = gasto o débito; negativo = pago, devolución, bonificación o crédito.
- Formatos locales: "1.234,56" es mil doscientos treinta y cuatro con cincuenta y seis. Las fechas dd/mm o dd-mmm van con el año del período (si el mes es posterior al cierre, es del año anterior).
- Consumos en dólares van con moneda USD aunque el resumen sea en pesos.
- Cuotas: "C.03/12" o "Cuota 3 de 12" → cuota_actual 3, cuota_total 12; el monto es el de la cuota de este resumen.
- "comercio": nombre corto y estable para agrupar entre meses (p. ej. "NETFLIX.COM 1234" → "Netflix", "MERPAGO*CAFEMARTINEZ" → "Café Martínez").
- "categoria": elegí el id más adecuado de la lista provista; null si no hay uno razonable.
- "total": total a pagar (tarjeta) o null si no figura.`;

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
  const { data: secret } = await admin.from("app_secrets").select("value").eq("key", "anthropic_api_key").maybeSingle();
  if (!secret?.value) return json({ error: "falta configurar anthropic_api_key en app_secrets" }, 500);

  const client = new Anthropic({ apiKey: secret.value });

  const listaCategorias = categorias.map((c) => `${c.id} = ${c.nombre}`).join("\n");
  const instruccion = `Archivo: ${archivo.nombre}\n\nCategorías disponibles (id = nombre):\n${listaCategorias || "(ninguna)"}\n\nExtraé todos los movimientos de este resumen.`;

  const content: Anthropic.Beta.BetaContentBlockParam[] = archivo.tipo === "pdf"
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo.data } },
        { type: "text", text: instruccion },
      ]
    : [{ type: "text", text: `<resumen>\n${archivo.data}\n</resumen>\n\n${instruccion}` }];

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") return json({ error: "el modelo no pudo procesar este archivo" }, 422);
    if (msg.stop_reason === "max_tokens") return json({ error: "el resumen es demasiado largo para procesarlo de una vez" }, 422);

    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const resultado = JSON.parse(text);
    return json({
      resultado,
      uso: { modelo: msg.model, entrada: msg.usage.input_tokens, salida: msg.usage.output_tokens },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "límite de uso de la API, intente de nuevo en un minuto" }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "la clave de la API de Claude no es válida" }, 500);
    if (err instanceof Anthropic.BadRequestError) return json({ error: `la API rechazó el archivo: ${err.message}` }, 400);
    if (err instanceof Anthropic.APIError) return json({ error: `error de la API (${err.status})` }, 502);
    console.error("[analizar-resumen]", err);
    return json({ error: "no se pudo leer el resumen" }, 500);
  }
});
