-- Alertas push de metas de gasto (send-reminders?tipo=metas).
-- Cada meta avisa una vez por nivel y por mes: 1 = en riesgo (proyección
-- sobre el tope o 80 % usado), 2 = superada. Solo la usa la Edge Function con
-- el service role: RLS activo y sin políticas.
create table if not exists public.alertas_enviadas (
  clave text primary key,          -- '<id de la meta>|YYYY-MM'
  nivel smallint not null,
  enviado_at timestamptz not null default now()
);
alter table public.alertas_enviadas enable row level security;

-- Programación (se aplica aparte, con la misma URL y Authorization que
-- recordatorio-diario): todos los días a las 23:30 UTC = 20:30 ART.
-- select cron.schedule('alertas-metas', '30 23 * * *', replace(command, 'tipo=diario', 'tipo=metas'))
--   from cron.job where jobname = 'recordatorio-diario';
