// Extracción con la API de Gemini (generateContent, REST). Se mantiene en un
// archivo aparte para poder probarlo sin Deno.

export class ProviderError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface Archivo { nombre: string; tipo: "pdf" | "texto"; data: string }

export interface Extraccion {
  resultado: unknown;
  uso: { modelo: string; entrada: number; salida: number };
}

interface Opciones {
  apiKey: string;
  model: string;
  system: string;
  schema: Record<string, unknown>;
  archivo: Archivo;
  instruccion: string;
  baseUrl?: string;
}

interface GeminiPart { text?: string; thought?: boolean }
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
  error?: { code?: number; message?: string; status?: string };
}

export async function extraerConGemini(o: Opciones): Promise<Extraccion> {
  const base = o.baseUrl ?? "https://generativelanguage.googleapis.com";
  const parts = o.archivo.tipo === "pdf"
    ? [{ inlineData: { mimeType: "application/pdf", data: o.archivo.data } }, { text: o.instruccion }]
    : [{ text: `<resumen>\n${o.archivo.data}\n</resumen>\n\n${o.instruccion}` }];

  const res = await fetch(`${base}/v1beta/models/${o.model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": o.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: o.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: o.schema,
        maxOutputTokens: 32768,
      },
    }),
  });

  let body: GeminiResponse;
  try {
    body = await res.json();
  } catch {
    throw new ProviderError(`respuesta inválida de Gemini (${res.status})`, 502);
  }

  if (!res.ok) {
    const msg = body.error?.message ?? `error ${res.status}`;
    if (res.status === 429) throw new ProviderError("límite de uso de Gemini, intente de nuevo en un minuto", 429);
    if (res.status === 400 && /API key/i.test(msg)) throw new ProviderError("la clave de Gemini no es válida", 500);
    if (res.status === 403) throw new ProviderError(`Gemini rechazó la clave o el acceso: ${msg}`, 500);
    throw new ProviderError(`Gemini respondió con un error: ${msg}`, res.status >= 500 ? 502 : 400);
  }

  if (body.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini bloqueó el archivo (${body.promptFeedback.blockReason})`, 422);
  }
  const cand = body.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") {
    throw new ProviderError("el resumen es demasiado largo para procesarlo de una vez", 422);
  }
  // Se ignoran las partes de "pensamiento": solo cuenta el texto de la respuesta
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new ProviderError(`Gemini no devolvió contenido (${cand?.finishReason ?? "sin motivo"})`, 502);

  let resultado: unknown;
  try {
    resultado = JSON.parse(text);
  } catch {
    throw new ProviderError("Gemini devolvió un JSON inválido", 502);
  }
  const u = body.usageMetadata ?? {};
  return {
    resultado,
    uso: {
      modelo: body.modelVersion ?? o.model,
      entrada: u.promptTokenCount ?? 0,
      salida: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
  };
}
