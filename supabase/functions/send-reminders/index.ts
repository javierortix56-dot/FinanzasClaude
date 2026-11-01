// Envía recordatorios push a los dispositivos suscriptos de Javier y Mary.
// Invocada por pg_cron:
//   ?tipo=diario  → 00:00 UTC (21:00 ART): si hoy no cargaron movimientos
//   ?tipo=cuotas  → día 1 de cada mes: resumen de cuotas que vencen
//   ?tipo=metas (o cupos) → 23:30 UTC (20:30 ART): categorías cuyo consumo real
//                  va a superar (o ya superó) lo planificado en el mes
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Payload = { title: string; body: string; url: string; tag: string };

// Fecha/mes en horario de Argentina (UTC-3)
function ahoraART(): Date {
  return new Date(Date.now() - 3 * 3600 * 1000);
}
function mesART(): string {
  const d = ahoraART();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function inicioDelDiaARTenUTC(): string {
  const d = ahoraART();
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day, 3, 0, 0)).toISOString(); // 00:00 ART = 03:00 UTC
}
function monthIndex(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return y * 12 + (m - 1);
}
const fmt = (n: number, moneda: string) =>
  `${moneda === "USD" ? "US$" : "$"}${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

// ── Cupos (planificado vs real) ──────────────────────────────────────────────
// Misma regla que packages/core/lib/planVsReal.ts: solo categorías con cupo
// (app_settings.categoriasCupo; sin configurar, las llamadas Mercado o
// Supermercado). El cupo es lo planificado en el mes (egresos sin pagos de
// tarjeta ni gastos no planificados, con el monto planificado); lo real son
// los consumos registrados (tabla consumos). Solo se evalúan las que tienen
// consumos. Aviso: en riesgo (80 % usado, o desde el día 7 la proyección
// supera el plan) o excedido; una vez por nivel, categoría y mes.

const DIA_MIN_PROYECCION = 7;

interface Grupo { id: string; nombre?: string; subcategorias?: { id: string; nombre?: string }[] }

async function payloadsCupos(): Promise<Payload[]> {
  const mes = mesART();
  const [y, m] = mes.split("-").map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dia = ahoraART().getUTCDate();
  const diasRestantes = Math.max(diasMes - dia, 0);
  const desde = `${mes}-01`;
  const hasta = `${mes}-${String(diasMes).padStart(2, "0")}`;

  const { data: consumos } = await supabase.from("consumos").select("monto, moneda, categoria").gte("fecha", desde).lte("fecha", hasta);
  if (!consumos || consumos.length === 0) return [];

  const { data: conf } = await supabase.from("configuracion").select("app_settings, transaction_cats").limit(1).maybeSingle();
  const app = conf?.app_settings ?? {};
  const base: string = ["ARS", "COP", "USD"].includes(app.monedaBase) ? app.monedaBase : "ARS";
  const tc = app.tipoCambio ?? {};
  const porUsd: Record<string, number> = { USD: 1, ARS: Number(tc.ARS_USD) || 1, COP: Number(tc.COP_USD) || 1 };
  const aBase = (monto: number, moneda: string) => (monto / (porUsd[moneda] ?? 1)) * porUsd[base];
  const grupos: Grupo[] = Array.isArray(conf?.transaction_cats) ? conf!.transaction_cats : [];
  const grupoDe = new Map<string, string>();
  const nombreDe = new Map<string, string>();
  for (const g of grupos) {
    nombreDe.set(g.id, g.nombre ?? g.id);
    for (const c of g.subcategorias ?? []) { grupoDe.set(c.id, g.id); nombreDe.set(c.id, c.nombre ?? c.id); }
  }
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cupoIds = new Set<string>(Array.isArray(app.categoriasCupo) ? app.categoriasCupo
    : grupos.flatMap((g) => (g.subcategorias ?? []).filter((c) => /^(mercado|supermercado)$/.test(norm(c.nombre ?? ""))).map((c) => c.id)));
  const esCupo = (cat: string) => cupoIds.has(cat) || (grupoDe.has(cat) && cupoIds.has(grupoDe.get(cat)!));

  const { data: rows } = await supabase
    .from("movimientos")
    .select("amount, orig_amt, currency, category, children")
    .is("deleted_at", null)
    .in("type", ["egreso", "exp"])
    .gte("date", desde)
    .lte("date", hasta);
  const plan = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.children?.pagoTarjeta || r.children?.noPlanificado || !esCupo(r.category)) continue;
    const pre = r.orig_amt != null && Math.abs(Number(r.orig_amt) - Number(r.amount)) > 0.01;
    const monto = r.children?.montoPlanificado != null ? Number(r.children.montoPlanificado) : Number(r.amount);
    plan.set(r.category, (plan.get(r.category) ?? 0) + aBase(monto, pre ? "ARS" : r.currency));
  }
  const clave = (cat: string) => (plan.has(cat) ? cat : grupoDe.has(cat) && plan.has(grupoDe.get(cat)!) ? grupoDe.get(cat)! : cat);
  const real = new Map<string, number>();
  for (const c of consumos.filter((x) => esCupo(x.categoria))) real.set(clave(c.categoria), (real.get(clave(c.categoria)) ?? 0) + aBase(Number(c.monto), c.moneda));

  const claves = [...real.keys()].map((k) => `cupo|${k}|${mes}`);
  const { data: enviadas } = await supabase.from("alertas_enviadas").select("clave, nivel").in("clave", claves);
  const yaEnviado = new Map((enviadas ?? []).map((e) => [e.clave as string, Number(e.nivel)]));

  const out: Payload[] = [];
  const nuevos: { clave: string; nivel: number; enviado_at: string }[] = [];
  for (const [cat, actual] of real) {
    const tope = plan.get(cat) ?? 0;
    if (tope <= 0) continue; // sin planificar: se ve en la app, no se avisa
    const proyeccion = (actual / Math.max(dia, 1)) * diasMes;
    let nivel = 0;
    if (actual > tope) nivel = 2;
    else if ((dia >= DIA_MIN_PROYECCION && proyeccion > tope) || actual >= tope * 0.8) nivel = 1;
    const k = `cupo|${cat}|${mes}`;
    if (nivel === 0 || nivel <= (yaEnviado.get(k) ?? 0)) continue;
    const nombre = nombreDe.get(cat) ?? cat;
    const porDia = diasRestantes > 0 && tope > actual ? (tope - actual) / diasRestantes : null;
    const body = nivel === 2
      ? `Superó lo planificado: lleva ${fmt(actual, base)} de ${fmt(tope, base)} (${fmt(actual - tope, base)} de más).`
      : `Lleva ${fmt(actual, base)} de ${fmt(tope, base)} planificado. A este ritmo cierra el mes en ${fmt(proyeccion, base)}.` +
        (porDia !== null ? ` Para no pasarse le quedan ${fmt(porDia, base)} por día.` : "");
    out.push({ title: `${nivel === 2 ? "🔴" : "🟠"} ${nombre}`, body, url: "/plan", tag: `finanzas-cupo-${cat}` });
    nuevos.push({ clave: k, nivel, enviado_at: new Date().toISOString() });
  }
  if (nuevos.length > 0) await supabase.from("alertas_enviadas").upsert(nuevos, { onConflict: "clave" });
  return out;
}

// ── Recordatorios ────────────────────────────────────────────────────────────

async function armarPayloads(tipo: string): Promise<Payload[]> {
  // "metas" es el nombre con el que quedó programado el cron
  if (tipo === "cupos" || tipo === "metas") return await payloadsCupos();

  if (tipo === "cuotas") {
    const { data } = await supabase.from("compras_cuotas").select("*");
    const mes = mesART();
    const idx = monthIndex(mes);
    const venMes = (data ?? []).filter((c) => {
      const n = idx - monthIndex(c.primer_mes) + 1;
      return n >= 1 && n <= c.total_cuotas;
    });
    if (venMes.length === 0) return [];
    const porMoneda: Record<string, number> = {};
    for (const c of venMes) porMoneda[c.moneda] = (porMoneda[c.moneda] ?? 0) + Number(c.monto_cuota);
    const detalle = Object.entries(porMoneda)
      .map(([mon, tot]) => `${mon} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(tot)}`)
      .join(" + ");
    return [{
      title: "💳 Cuotas de este mes",
      body: `Vencen ${venMes.length} cuota${venMes.length !== 1 ? "s" : ""}: ${detalle}`,
      url: "/analisis",
      tag: "finanzas-cuotas",
    }];
  }

  // tipo=diario: solo si hoy no se cargó ningún movimiento ni consumo
  const { count } = await supabase
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("created_at", inicioDelDiaARTenUTC());
  const { count: consumosHoy } = await supabase
    .from("consumos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", inicioDelDiaARTenUTC());
  if ((count ?? 0) + (consumosHoy ?? 0) > 0) return [];
  return [{
    title: "📝 Finanzas J&M",
    body: "Hoy no cargaron ningún movimiento. ¿Se les escapó algún gasto?",
    url: "/dashboard",
    tag: "finanzas-diario",
  }];
}

Deno.serve(async (req: Request) => {
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "diario";

  // Claves VAPID desde app_secrets (solo service role puede leerla)
  const { data: secrets, error: secErr } = await supabase.from("app_secrets").select("key, value");
  const pub = secrets?.find((s) => s.key === "vapid_public")?.value;
  const priv = secrets?.find((s) => s.key === "vapid_private")?.value;
  if (secErr || !pub || !priv) {
    return new Response(JSON.stringify({ error: "vapid keys missing" }), { status: 500 });
  }
  webpush.setVapidDetails("mailto:javierortix56@gmail.com", pub, priv);

  const payloads = await armarPayloads(tipo);
  if (payloads.length === 0) {
    return new Response(JSON.stringify({ tipo, sent: 0, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  let sent = 0;
  const muertas = new Set<string>();

  for (const payload of payloads) {
    for (const s of subs ?? []) {
      if (muertas.has(s.endpoint)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) muertas.add(s.endpoint);
        else console.error("[push] error:", s.endpoint.slice(0, 40), err);
      }
    }
  }

  // Limpieza de suscripciones vencidas
  if (muertas.size > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", [...muertas]);
  }

  return new Response(JSON.stringify({ tipo, sent, alertas: payloads.length, pruned: muertas.size }), {
    headers: { "Content-Type": "application/json" },
  });
});
