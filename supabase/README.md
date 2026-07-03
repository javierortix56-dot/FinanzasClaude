# Supabase — Auth y seguridad

Este directorio documenta el estado de la base de datos del proyecto
**Nueva Finanzas** (`uvoufmnmspozbmxsumdi`). Las migraciones en `migrations/`
**ya fueron aplicadas** al proyecto (2026-07-03); se versionan acá como registro.

## Modelo de seguridad

- **Supabase Auth** con email + contraseña. Los usuarios se crean manualmente
  (no hay signup público en la app).
- **RLS habilitado** en todas las tablas (`movimientos`, `cuentas`,
  `configuracion`, `presupuestos`, `allowed_users`).
- El acceso lo controla la tabla `allowed_users`: solo los emails listados
  ahí pueden leer/escribir datos (vía la función `is_allowed_user()`).
  Aunque alguien creara una cuenta en el proyecto, sin estar en esa lista
  no puede tocar nada.
- Los datos siguen siendo **compartidos** entre los usuarios habilitados
  (finanzas de pareja), igual que antes.

## ⚠️ Paso pendiente post-deploy

Existen políticas `TEMP anon full access` que mantienen funcionando la
versión desplegada SIN login hasta que se deploye este branch. Una vez que
el deploy con login esté activo y ambos usuarios hayan entrado, ejecutar
`post-deploy-drop-temp-anon.sql` en el SQL Editor. **Hasta entonces, los
datos siguen tan expuestos como antes.**

## Agregar un usuario (ej. Mary)

En el SQL Editor de Supabase, con su email real:

```sql
-- 1. Habilitarla en la app
insert into public.allowed_users (email, nombre)
values ('EMAIL_DE_MARY', 'Mary');

-- 2. Crear su cuenta con contraseña
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated',
    'EMAIL_DE_MARY',
    extensions.crypt('CONTRASEÑA_DE_MARY', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"nombre":"Mary"}'::jsonb,
    now(), now(), '', '', '', '', '', 0, '', '', '', false, false
  ) returning id, email
)
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), id::text, id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from new_user;
```

## Cambiar una contraseña

```sql
update auth.users
set encrypted_password = extensions.crypt('NUEVA_CONTRASEÑA', extensions.gen_salt('bf'))
where email = 'EMAIL';
```
