-- Pendiente de aplicar en Supabase (SQL Editor) antes de usar el reproductor
-- de sesion GFIT (OSGfitReproductor.tsx). Agrega soporte a series por duracion
-- (ej. planchas, isometricos, estiramiento dentro de una rutina GFIT).
--
-- No se aplico automaticamente. Ejecutar a mano y confirmar antes de commitear
-- el codigo que depende de estas columnas.

set search_path = public;

alter table gfit_series_plan
  add column if not exists duracion_s integer;

alter table gfit_sesion_series
  add column if not exists duracion_s integer;

notify pgrst, 'reload schema';
