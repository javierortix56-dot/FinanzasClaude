// Lee con IA (Gemini, visión) una foto de ticket o una captura de pantalla de
// movimientos (app del banco, Mercado Pago, billetera) y devuelve los gastos
// como JSON: fecha, comercio, monto, moneda, categoría sugerida y medio de
// pago. No guarda nada: la app muestra el resultado para revisar y lo guarda
// con la sesión del usuario (RLS).
//
// Usa `gemini_api_key` de app_secrets (solo la lee el service role).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL_GEMINI = "gemini-3.8-flash";
const MAX_BASE64 = 8_000_000; // ~6 MB de imagen

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface Payload {
  imagen: { data: string; mime: string };
  modo: "ticket" | "movimientos";
  /** YYYY-MM-DD de hoy en el teléfono (para "Hoy", "Ayer", fechas sin año) */
  hoy: string;
  categorias?: { id: string; nombre: string }[];
  tarjetas?: string[];
}

const nullable = (t: Record<string, unknown>) => ({ anyOf: [t, { type: "null" }] });

const SCHEMA = {
  type: "object",
  properties: {
    movimientos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fecha: nullable({ type: "string", description: "YYYY-MM-DD" }),
          comercio: { type: "string", description: "Nombre corto y legible del comercio o destinatario" },
          descripcion: { type: "string", description: "Texto tal como aparece en la imagen" },
          monto: { type: "number", description: "Importe positivo, sin signo" },
          moneda: { type: "string", enum: ["ARS", "USD", "COP"] },
          es_gasto: { type: "boolean", description: "true si es un pago o compra; false si es un ingreso, reintegro, transferencia recibida o movimiento entre cuentas propias" },
          categoria: nullable({ type: "string", description: "id de la lista de categorías" }),
          medio: nullable({ type: "string", enum: ["credito", "debito", "efectivo", "transferencia", "otro"] }),
          tarjeta: nullable({ type: "string", description: "Nombre exacto de la lista de tarjetas si el medio es tarjeta de crédito y se puede saber cuál" }),
          cuotas: nullable({ type: "integer", description: "Cantidad de cuotas si la compra es en cuotas" }),
        },
        required: ["fecha", "comercio", "descripcion", "monto", "moneda", "es_gasto", "categoria", "medio", "tarjeta", "cuotas"],
      },
    },
  },
  required: ["movimientos"],
};

const SYSTEM = `Leés imágenes de comprobantes de gastos personales en Argentina (también puede haber pesos colombianos o dólares).

Dos tipos de imagen:
- Ticket o factura de compra: devolvé UN solo movimiento con el TOTAL pagado (no los ítems ni subtotales). La fecha es la del ticket.
- Captura de pantalla de movimientos (app del banco, Mercado Pago, billetera, resumen del día): devolvé UN movimiento por cada fila. No inventes filas, no repitas filas y no incluyas saldos, totales del día ni encabezados.

Reglas:
- "monto": siempre positivo. Formato argentino: el punto separa miles y la coma, decimales ("$ 20.000,50" = 20000.5).
- "es_gasto": false para ingresos, sueldos, reintegros, devoluciones, transferencias recibidas, rendimientos y movimientos entre cuentas propias.
- "fecha": resolvé "Hoy", "Ayer" y fechas sin año usando la fecha de hoy que se indica. Si no hay fecha, null.
- "comercio": nombre limpio y corto ("3SM*PALERMO MARKET" → "Palermo Market", "MERPAGO*CARNICO" → "Carnico"). Para transferencias enviadas, el nombre del destinatario.
- "categoria": el id más adecuado de la lista. Supermercados, almacenes, minimercados, verdulerías y carnicerías van a la categoría de mercado/supermercado/comida si existe. null si ninguna aplica.
- "medio": si la imagen lo indica (tarjeta de crédito, débito, dinero en cuenta, transferencia, efectivo). Una compra con "dinero disponible" de Mercado Pago es "debito". null si no se sabe.
- "tarjeta": solo si el medio es crédito y la imagen permite saber cuál tarjeta de la lista es (por banco, marca o últimos dígitos). Si no, null.`;

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
  const { imagen, modo, hoy, categorias = [], tarjetas = [] } = body;
  if (!imagen?.data || !/^image\//.test(imagen.mime ?? "")) return json({ error: "falta la imagen" }, 400);
  if (imagen.data.length > MAX_BASE64) return json({ error: "imagen demasiado grande" }, 413);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secrets } = await admin.from("app_secrets").select("key, value").eq("key", "gemini_api_key");
  const apiKey = secrets?.[0]?.value as string | undefined;
  if (!apiKey) return json({ error: "falta configurar gemini_api_key en app_secrets" }, 500);

  const instruccion = [
    `Tipo de imagen: ${modo === "ticket" ? "ticket o factura de compra" : "captura de pantalla de movimientos"}.`,
    `Fecha de hoy: ${hoy}.`,
    `Categorías disponibles (id = nombre):\n${categorias.map((c) => `${c.id} = ${c.nombre}`).join("\n") || "(ninguna)"}`,
    `Tarjetas de crédito del usuario: ${tarjetas.join(", ") || "(ninguna)"}.`,
  ].join("\n\n");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_GEMINI}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: imagen.mime, data: imagen.data } }, { text: instruccion }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA, maxOutputTokens: 16384 },
    }),
  });

  // deno-lint-ignore no-explicit-any
  let r: any;
  try {
    r = await res.json();
  } catch {
    return json({ error: `respuesta inválida de Gemini (${res.status})` }, 502);
  }
  if (!res.ok) {
    if (res.status === 429) return json({ error: "límite de uso de Gemini, intente de nuevo en un minuto" }, 429);
    return json({ error: `Gemini respondió con un error: ${r?.error?.message ?? res.status}` }, 502);
  }
  if (r.promptFeedback?.blockReason) return json({ error: `Gemini bloqueó la imagen (${r.promptFeedback.blockReason})` }, 422);
  const cand = r.candidates?.[0];
  // deno-lint-ignore no-explicit-any
  const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
  if (!text) return json({ error: `Gemini no devolvió contenido (${cand?.finishReason ?? "sin motivo"})` }, 502);
  try {
    return json({ resultado: JSON.parse(text), modelo: r.modelVersion ?? MODEL_GEMINI });
  } catch {
    return json({ error: "Gemini devolvió un JSON inválido" }, 502);
  }
});
