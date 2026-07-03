-- Aplicada el 2026-07-03. Usuarios habilitados + RLS en todas las tablas.

-- Usuarios habilitados a operar la app (finanzas compartidas J&M)
create table if not exists public.allowed_users (
  email text primary key,
  nombre text not null default '',
  created_at timestamptz not null default now()
);

insert into public.allowed_users (email, nombre)
values ('javierortix56@gmail.com', 'Javier')
on conflict (email) do nothing;

-- Función helper: ¿el JWT actual pertenece a un usuario habilitado?
-- security definer para poder leer allowed_users sin exponerla via RLS.
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to authenticated;

-- Habilitar RLS en todas las tablas
alter table public.allowed_users enable row level security;
alter table public.movimientos enable row level security;
alter table public.cuentas enable row level security;
alter table public.configuracion enable row level security;

-- Usuarios autenticados y habilitados: acceso total (datos compartidos)
create policy "allowed users select" on public.movimientos for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.movimientos for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.movimientos for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.movimientos for delete to authenticated using (public.is_allowed_user());

create policy "allowed users select" on public.cuentas for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.cuentas for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.cuentas for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.cuentas for delete to authenticated using (public.is_allowed_user());

create policy "allowed users select" on public.configuracion for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.configuracion for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.configuracion for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.configuracion for delete to authenticated using (public.is_allowed_user());

-- Los usuarios habilitados pueden ver la lista de habilitados
create policy "allowed users select" on public.allowed_users for select to authenticated using (public.is_allowed_user());

-- ── POLÍTICAS TEMPORALES ──────────────────────────────────────────────────
-- Mantienen funcionando la versión desplegada actual (sin login) hasta que
-- se deploye el frontend con auth. Eliminar con post-deploy-drop-temp-anon.sql
create policy "TEMP anon full access" on public.movimientos for all to anon using (true) with check (true);
create policy "TEMP anon full access" on public.cuentas for all to anon using (true) with check (true);
create policy "TEMP anon full access" on public.configuracion for all to anon using (true) with check (true);
