-- GFIT: gfit_sesion_series le falta duracion_s, columna que el codigo ya
-- intenta insertar hace tiempo (src/routes/api/gfit/sesion-series.ts, antes
-- src/pages/api/gfit/sesion-series.ts en Astro). Bug de produccion
-- preexistente, no introducido por la migracion de framework: hoy CUALQUIER
-- serie con duracion_s (planchas, isometricos, cardio) responde 502 porque
-- Supabase rechaza el insert con 42703 "column does not exist" -- verificado
-- en vivo contra la tabla real, no es teorico.
-- Safe: agrega una columna nullable, no toca datos existentes.
-- Idempotente: IF NOT EXISTS.
-- Apply en el SQL editor de Supabase o via `supabase db push` contra el
-- proyecto correcto. Verificar el project ref antes de correr.

do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'gfit_sesion_series') then
    execute 'alter table public.gfit_sesion_series add column if not exists duracion_s integer';
  end if;
end $$;

-- Ask PostgREST to reload its schema cache so la columna nueva sea escribible
-- de inmediato (Supabase escucha en el canal pgrst).
notify pgrst, 'reload schema';
