// Cierre diario de habitos, portado de src/pages/api/habitos/cierre.ts (Astro).
//
// Vive en src/server/ y no dentro de la server route porque tiene TRES
// consumidores: la propia route /api/habitos/cierre, el fallback lazy del GET de
// /api/habitos, y el orquestador de /api/juego/cierre. En Astro el import
// cruzado era `from './habitos/cierre'` (un archivo de pagina importando otro
// archivo de pagina); aca eso seria un import entre server routes, que ademas de
// feo arrastraria la definicion de ruta del importado.

import type { SupabaseClient } from '@supabase/supabase-js';
import { hoyLocal, addDias, diaIso, timestampGuayaquil } from '../lib/habitos/fechas.ts';
import { penalizacionFallo, type Dificultad } from '../lib/habitos/scoring.ts';

type SB = SupabaseClient;

// Días pendientes de cierre: desde el día siguiente al último cierre registrado (o
// desde ayer si no hay ninguno) hasta AYER inclusive. Hoy nunca se cierra (aún corre).
function diasPendientes(ultimoCierre: string | null, hoy: string): string[] {
  const ayer = addDias(hoy, -1);
  const desde = ultimoCierre ? addDias(ultimoCierre, 1) : ayer;
  const dias: string[] = [];
  let cursor = desde;
  let guard = 0;
  while (cursor <= ayer && guard < 3660) {
    dias.push(cursor);
    cursor = addDias(cursor, 1);
    guard += 1;
  }
  return dias;
}

// Cierra un único día: aplica penalizacionFallo al valor de cada diaria activa
// programada ese día (creada antes o ese mismo día) que no tenga check 'mas' esa
// fecha, detecta día perfecto, e inserta la fila en habito_cierres. Idempotente en dos
// capas: primero verifica si el día ya está cerrado (evita re-penalizar en una carrera
// entre el POST de n8n y el fallback lazy de GET habitos), y si aun así el insert choca
// contra la pk duplicada, lo trata igual como ya procesado.
async function cerrarDia(sb: SB, dia: string): Promise<{ resumen: Record<string, unknown>; insertado: boolean }> {
  const { data: existente, error: errExiste } = await sb
    .from('habito_cierres')
    .select('fecha')
    .eq('fecha', dia)
    .maybeSingle();
  if (errExiste) throw errExiste;
  if (existente) return { resumen: {}, insertado: false };

  const { data: habitosData, error: errHabitos } = await sb
    .from('habitos')
    .select('id, nombre, dificultad, valor, dias_semana, created_at, es_core')
    .eq('tipo', 'diaria')
    .eq('estado', 'activo');
  if (errHabitos) throw errHabitos;

  const programadas = (habitosData ?? []).filter(
    (h) => (h.dias_semana ?? []).includes(diaIso(dia)) && (h.created_at ?? '').slice(0, 10) <= dia,
  );

  // falladas: nombres (compat con resúmenes viejos que solo listaban strings) +
  // falladasDetalle: shape completo ({id, nombre, dificultad, valor, es_core}) que el
  // motor B necesita para calcular daño HP sin tener que releer la tabla habitos.
  const falladas: string[] = [];
  const falladasDetalle: Array<{
    id: string;
    nombre: string;
    dificultad: Dificultad;
    valor: number;
    es_core: boolean;
  }> = [];
  if (programadas.length) {
    const ids = programadas.map((h) => h.id);
    const { data: checksData, error: errChecks } = await sb
      .from('habito_checks')
      .select('habito_id')
      .in('habito_id', ids)
      .eq('fecha', dia)
      .eq('signo', 'mas');
    if (errChecks) throw errChecks;
    const hechos = new Set((checksData ?? []).map((c) => c.habito_id));

    for (const h of programadas) {
      if (hechos.has(h.id)) continue;
      falladas.push(h.nombre);
      falladasDetalle.push({
        id: h.id,
        nombre: h.nombre,
        dificultad: h.dificultad as Dificultad,
        valor: h.valor ?? 0,
        es_core: !!h.es_core,
      });
      const valorNuevo = penalizacionFallo(h.valor ?? 0, h.dificultad as Dificultad);
      const { error: errUpdate } = await sb
        .from('habitos')
        .update({ valor: valorNuevo, updated_at: new Date().toISOString() })
        .eq('id', h.id);
      if (errUpdate) throw errUpdate;
    }
  }

  // Día perfecto: hubo al menos una diaria programada y ninguna falló.
  const diaPerfecto = programadas.length > 0 && falladas.length === 0;
  const resumen = {
    diarias_falladas: falladas,
    diarias_falladas_detalle: falladasDetalle,
    dia_perfecto: diaPerfecto,
    programadas: programadas.length,
  };

  const { error: errInsert } = await sb.from('habito_cierres').insert([{ fecha: dia, resumen }]);
  if (errInsert) {
    // pk duplicada (23505): otro proceso ya insertó el cierre de este día. Saltar.
    if ((errInsert as { code?: string }).code === '23505') return { resumen, insertado: false };
    throw errInsert;
  }

  return { resumen, insertado: true };
}

// Re-agenda el recordatorio one-shot de HOY para hábitos activos con hora_recordatorio
// programados hoy (dias_semana), si no existe ya un recordatorio pendiente de ese
// habito_id con recordar_at dentro de hoy.
async function reagendarRecordatoriosHoy(sb: SB, hoy: string): Promise<void> {
  const { data: habitosData, error: errHabitos } = await sb
    .from('habitos')
    .select('id, nombre, intencion, dias_semana, hora_recordatorio')
    .eq('estado', 'activo')
    .not('hora_recordatorio', 'is', null);
  if (errHabitos) throw errHabitos;

  const habitosHoy = (habitosData ?? []).filter((h) => (h.dias_semana ?? []).includes(diaIso(hoy)));
  if (habitosHoy.length === 0) return;

  const inicioHoy = `${hoy}T00:00:00-05:00`;
  const inicioManana = `${addDias(hoy, 1)}T00:00:00-05:00`;
  const habitosIds = habitosHoy.map((h) => h.id);

  const { data: pendientesData, error: errPendientes } = await sb
    .from('recordatorios')
    .select('habito_id')
    .in('habito_id', habitosIds)
    .eq('estado', 'pendiente')
    .gte('recordar_at', inicioHoy)
    .lt('recordar_at', inicioManana);
  if (errPendientes) throw errPendientes;

  const habitosConPendientes = new Set((pendientesData ?? []).map((p) => p.habito_id));
  const inserts = [];

  for (const h of habitosHoy) {
    if (habitosConPendientes.has(h.id)) continue;

    const recordarAt = timestampGuayaquil(hoy, h.hora_recordatorio as string);
    inserts.push({
      mensaje: h.intencion?.trim() || h.nombre,
      recordar_at: recordarAt.toISOString(),
      canal: 'telegram',
      habito_id: h.id,
    });
  }

  if (inserts.length > 0) {
    const { error: errInsertRec } = await sb.from('recordatorios').insert(inserts);
    if (errInsertRec) throw errInsertRec;
  }
}

// Procesa todos los días pendientes de cierre (desde el último habito_cierres + 1 hasta
// ayer) y luego re-agenda los recordatorios de hoy. Reutilizable desde el POST del
// endpoint de cierre, desde el fallback lazy en GET /api/habitos y desde
// /api/juego/cierre.
export async function cerrarPendientes(
  sb: SB,
): Promise<{ cerrados: string[]; resumenes: Record<string, unknown> }> {
  const hoy = hoyLocal();
  const { data: ultimo, error: errUltimo } = await sb
    .from('habito_cierres')
    .select('fecha')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errUltimo) throw errUltimo;

  const dias = diasPendientes(ultimo?.fecha ?? null, hoy);
  const cerrados: string[] = [];
  const resumenes: Record<string, unknown> = {};

  for (const dia of dias) {
    const { resumen, insertado } = await cerrarDia(sb, dia);
    if (insertado) {
      cerrados.push(dia);
      resumenes[dia] = resumen;
    }
  }

  await reagendarRecordatoriosHoy(sb, hoy);

  return { cerrados, resumenes };
}
