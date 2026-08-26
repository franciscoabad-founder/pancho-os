-- Fase A: campos que vuelven accionables los módulos CRM y Recordatorios.
-- Todos los cambios son aditivos para poder aplicar la migración sobre la DB
-- existente sin depender de un snapshot local completo.

alter table if exists public.crm_leads
  add column if not exists cargo text,
  add column if not exists producto text,
  add column if not exists ultimo_contacto date,
  add column if not exists proximo_contacto date;

-- `estado` es texto en las instalaciones existentes. No se impone una CHECK:
-- Hermes y los recordatorios históricos pueden seguir usando sus estados.
alter table if exists public.recordatorios
  alter column estado set default 'pendiente';

-- Hábitos base de la metodología semanal. Se insertan solo cuando todavía no
-- existe ese nombre, así que la migración no duplica configuraciones manuales.
insert into public.habitos (
  nombre, descripcion, tipo, dificultad, intencion, dias_semana,
  es_core, en_checklist, estado, source, orden
)
select v.nombre, v.descripcion, 'diaria', v.dificultad, v.intencion,
       array[1,2,3,4,5,6,7], true, true, 'activo', 'manual', v.orden
from (values
  ('Sueño consistente', 'Dormir y despertar dentro de tu horario fijo.', 'media', 'Protejo mi energía de mañana.', 10),
  ('Movimiento del día', 'Fuerza en Manager, movimiento corto en Maker o recuperación en Off.', 'media', 'Muevo mi cuerpo según el tipo de día.', 20),
  ('Comidas logueadas', 'Registro mis comidas dentro de la ventana que elegí.', 'facil', 'Hago visible mi nutrición.', 30),
  ('Agua', 'Completo mi hidratación diaria.', 'facil', 'Empiezo por cuidar el cuerpo que ejecuta el plan.', 40)
) as v(nombre, descripcion, dificultad, intencion, orden)
where not exists (select 1 from public.habitos h where h.nombre = v.nombre);
