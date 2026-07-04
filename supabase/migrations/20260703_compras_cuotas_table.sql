-- Aplicada el 2026-07-03.
-- Compras en cuotas con tarjeta de crédito (cargadas a mano o importadas
-- desde el extracto). Se proyectan como compromisos de meses futuros.
create table if not exists public.compras_cuotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000000',
  descripcion text not null,
  tarjeta text not null default '',
  moneda text not null check (moneda in ('ARS','COP','USD')),
  monto_cuota numeric not null check (monto_cuota > 0),
  total_cuotas int not null check (total_cuotas >= 1),
  -- Mes de la PRIMERA cuota, formato 'YYYY-MM'
  primer_mes text not null check (primer_mes ~ '^\d{4}-\d{2}$'),
  creado_por text not null default 'shared',
  created_at timestamptz not null default now()
);

alter table public.compras_cuotas enable row level security;

create policy "allowed users select" on public.compras_cuotas for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.compras_cuotas for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.compras_cuotas for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.compras_cuotas for delete to authenticated using (public.is_allowed_user());
