-- Resúmenes de banco / tarjeta importados (PDF, CSV o Excel) y sus renglones.
-- La extracción la hace la Edge Function `analizar-resumen`; la app guarda el
-- resultado acá para analizar varios meses (suscripciones, gastos hormiga,
-- cuotas, consumos no cargados).
create table if not exists public.resumenes (
  id uuid primary key default gen_random_uuid(),
  emisor text not null,
  tipo text not null check (tipo in ('tarjeta', 'cuenta')),
  periodo text not null check (periodo ~ '^\d{4}-\d{2}$'),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'COP', 'USD')),
  total numeric,
  archivo text not null default '',
  creado_por text not null default '',
  created_at timestamptz not null default now(),
  unique (emisor, periodo)
);

create table if not exists public.resumen_items (
  id uuid primary key default gen_random_uuid(),
  resumen_id uuid not null references public.resumenes(id) on delete cascade,
  fecha date not null,
  descripcion text not null default '',
  comercio text not null default '',
  monto numeric not null,
  moneda text not null check (moneda in ('ARS', 'COP', 'USD')),
  cuota_actual int,
  cuota_total int,
  tipo text not null default 'consumo',
  categoria text
);

create index if not exists resumen_items_resumen_idx on public.resumen_items (resumen_id);

alter table public.resumenes enable row level security;
alter table public.resumen_items enable row level security;

create policy "allowed users select" on public.resumenes for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.resumenes for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.resumenes for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.resumenes for delete to authenticated using (public.is_allowed_user());

create policy "allowed users select" on public.resumen_items for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.resumen_items for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.resumen_items for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.resumen_items for delete to authenticated using (public.is_allowed_user());

-- La clave de la API de Claude se guarda en app_secrets (solo service role):
--   insert into public.app_secrets (key, value) values ('anthropic_api_key', 'sk-ant-...');
