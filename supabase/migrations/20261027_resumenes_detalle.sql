-- Datos de cabecera del resumen (saldos, vencimientos, tasas, cuotas a vencer,
-- planes y avisos del banco) y titular/adicional de cada renglón.
alter table public.resumenes add column if not exists detalle jsonb;
alter table public.resumen_items add column if not exists titular text;
