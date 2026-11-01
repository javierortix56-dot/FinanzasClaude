-- Consumos reales: lo que se va gastando (registrado a mano, con foto de
-- ticket, con captura de movimientos o desde el resumen de la tarjeta).
-- NO son movimientos: no suman a caja, asignaciones ni pagos de tarjeta. Se
-- comparan con lo planificado (los egresos del mes de la misma categoría) para
-- ver el avance del cupo, el desvío mes a mes y avisar si se va a exceder.
create table if not exists public.consumos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  monto numeric not null check (monto > 0),
  moneda text not null check (moneda in ('ARS','COP','USD')),
  categoria text not null,
  comercio text not null default '',
  descripcion text not null default '',
  -- credito | debito | efectivo | transferencia | otro (null = sin indicar)
  medio text check (medio in ('credito','debito','efectivo','transferencia','otro')),
  tarjeta_id text,
  -- manual | ticket | captura | resumen
  fuente text not null default 'manual',
  creado_por text not null default 'shared',
  created_at timestamptz not null default now()
);
create index if not exists consumos_fecha_idx on public.consumos (fecha);

alter table public.consumos enable row level security;
create policy "allowed users select" on public.consumos for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.consumos for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.consumos for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.consumos for delete to authenticated using (public.is_allowed_user());

-- Realtime (los cambios de un teléfono se ven en el otro)
alter publication supabase_realtime add table public.consumos;
