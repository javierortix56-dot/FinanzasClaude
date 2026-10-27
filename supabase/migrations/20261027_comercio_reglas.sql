-- Nombre y categoría elegidos por el usuario para cada comercio de los
-- resúmenes. Se aplican solos a los resúmenes siguientes, así solo hay que
-- validar los comercios nuevos. `clave` es el texto normalizado (sin números
-- ni signos) de la descripción del banco o del nombre que propuso la IA.
create table if not exists public.comercio_reglas (
  clave text primary key,
  nombre text not null,
  categoria text,
  updated_at timestamptz not null default now()
);

alter table public.comercio_reglas enable row level security;

create policy "allowed users select" on public.comercio_reglas for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.comercio_reglas for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.comercio_reglas for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.comercio_reglas for delete to authenticated using (public.is_allowed_user());
