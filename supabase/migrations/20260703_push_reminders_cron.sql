-- Aplicada el 2026-07-03.
-- Programación de los recordatorios push vía pg_cron + pg_net.
-- (El Bearer usado en los jobs es la anon key pública del proyecto — la misma
--  que viaja en el bundle del frontend; la función valida el JWT.)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Recordatorio diario: 00:00 UTC = 21:00 Argentina / 19:00 Colombia
-- select cron.schedule('recordatorio-diario', '0 0 * * *', $$ net.http_post(... ?tipo=diario ...) $$);

-- Resumen de cuotas: día 1 de cada mes, 13:00 UTC = 10:00 ART / 08:00 COT
-- select cron.schedule('recordatorio-cuotas', '0 13 1 * *', $$ net.http_post(... ?tipo=cuotas ...) $$);

-- Los jobs completos (con la URL y el header Authorization) están aplicados
-- en la base; ver cron.job. Para pausarlos: select cron.unschedule('recordatorio-diario');
