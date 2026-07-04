-- Aplicada el 2026-07-03.
-- Suscripciones Web Push de los dispositivos de Javier y Mary
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  usuario text not null default '',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "allowed users select" on public.push_subscriptions for select to authenticated using (public.is_allowed_user());
create policy "allowed users insert" on public.push_subscriptions for insert to authenticated with check (public.is_allowed_user());
create policy "allowed users update" on public.push_subscriptions for update to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user());
create policy "allowed users delete" on public.push_subscriptions for delete to authenticated using (public.is_allowed_user());

-- Secretos de la app (claves VAPID) — SOLO accesibles con service role
-- (la Edge Function). RLS activo sin políticas + revoke: doble candado.
-- Los valores se insertan por fuera del repo:
--   insert into app_secrets (key, value) values ('vapid_public', '…'), ('vapid_private', '…');
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on table public.app_secrets from anon, authenticated;
