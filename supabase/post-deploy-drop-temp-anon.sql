-- Ejecutar DESPUÉS de deployar el frontend con login y de que ambos
-- usuarios hayan iniciado sesión al menos una vez.
-- Elimina el acceso anónimo temporal: a partir de acá, solo usuarios
-- autenticados y habilitados en allowed_users pueden tocar los datos.

drop policy "TEMP anon full access" on public.movimientos;
drop policy "TEMP anon full access" on public.cuentas;
drop policy "TEMP anon full access" on public.configuracion;
drop policy "TEMP anon full access" on public.presupuestos;
