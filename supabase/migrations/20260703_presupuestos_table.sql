-- Aplicada el 2026-07-03.
-- Presupuestos por categoría y mes: tabla propia en vez de JSON dentro de
-- configuracion.app_settings (que sufría carreras de escritura y se borraba
-- al guardar otros ajustes).
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000000',
  categoria text not null,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  limite numeric not null check (limite >= 0),
  moneda text not null check (moneda in ('ARS','COP','USD')),
  created_at timestamptz not null default now(),
  unique (categoria, mes)
);

alter table public.presupuestos enable row level security;

create policy "allowed users select" on public.presupuestos for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.presupuestos for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.presupuestos for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.presupuestos for delete to authenticated using (public.is_allowed_user());

-- TEMP: igual que las demás tablas, hasta el deploy del frontend con auth
create policy "TEMP anon full access" on public.presupuestos for all to anon using (true) with check (true);

-- Migrar presupuestos existentes del JSON (si los hubiera)
insert into public.presupuestos (id, user_id, categoria, mes, limite, moneda)
select
  coalesce(nullif(b->>'id','')::uuid, gen_random_uuid()),
  '00000000-0000-0000-0000-000000000000',
  b->>'categoria',
  b->>'mes',
  (b->>'limite')::numeric,
  coalesce(b->>'moneda','ARS')
from public.configuracion,
     jsonb_array_elements(coalesce(app_settings->'budgets','[]'::jsonb)) as b
where user_id = '00000000-0000-0000-0000-000000000000'
on conflict (categoria, mes) do nothing;
