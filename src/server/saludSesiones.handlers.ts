// Logica de /api/salud/sesiones, portada de src/pages/api/salud/sesiones.ts.
// Sesiones de entrenamiento del modulo Salud (tabla `sesiones` + `sets_log`).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull, hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { registrarEvento } from '../lib/juego/motor.ts';

const TIPOS = ['gym', 'caminata', 'cardio', 'movilidad', 'estiramiento'];
const TIPOS_SET = ['warmup', 'working', 'dropset', 'superset', 'amrap', 'failure'];

const SEL = '*, sets_log(*, ejercicio:ejercicios(id,nombre,patron,grupo_muscular_primario))';

// Inserta la lista de sets de una sesión (reemplaza los existentes).
async function guardarSets(sb: SupabaseClient, sesionId: string, sets: unknown) {
  if (!Array.isArray(sets)) return;
  await sb.from('sets_log').delete().eq('sesion_id', sesionId);
  if (!sets.length) return;
  const filas = sets.map((s: Record<string, unknown>, i: number) => ({
    sesion_id: sesionId,
    ejercicio_id: s.ejercicio_id,
    orden: typeof s.orden === 'number' ? s.orden : i,
    tipo_set: TIPOS_SET.includes(String(s.tipo_set)) ? s.tipo_set : 'working',
    reps: numOrNull(s.reps),
    peso_kg: numOrNull(s.peso_kg),
    rpe: numOrNull(s.rpe),
    completado: !!s.completado,
  }));
  const { error } = await sb.from('sets_log').insert(filas);
  if (error) throw error;
}

export async function leerSesiones(params: { id: string | null; limitParam: string | null }) {
  const sb = getSupabaseServer();
  if (params.id) {
    const { data, error } = await sb.from('sesiones').select(SEL).eq('id', params.id).single();
    if (error) throw error;
    return { sesion: data };
  }
  const limite = Number(params.limitParam) || 100;
  const { data, error } = await sb
    .from('sesiones')
    .select(SEL)
    .order('fecha', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return { sesiones: data ?? [] };
}

export async function crearSesion(body: Record<string, any>) {
  const tipo = body.tipo?.trim() || 'gym';
  if (!TIPOS.includes(tipo)) throw error400('tipo inválido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('sesiones')
    .insert([{
      fecha: body.fecha?.trim() || hoyGuayaquil(),
      rutina_id: body.rutina_id || null,
      tipo,
      duracion_min: numOrNull(body.duracion_min),
      notas: body.notas?.trim() || null,
      rpe_sesion: numOrNull(body.rpe_sesion),
      source: body.source?.trim() || 'manual',
      inicio: body.inicio?.trim() || null,
      fin: body.fin?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  await guardarSets(sb, data.id, body.sets);
  registrarEvento(sb, { tipo: 'sesion_gym', ref_tabla: 'sesiones', ref_id: data.id }).catch(() => null);
  const { data: full } = await sb.from('sesiones').select(SEL).eq('id', data.id).single();
  return full ?? data;
}

export async function actualizarSesion(id: string, body: Record<string, any>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of ['notas', 'fecha']) if (c in body) patch[c] = body[c]?.trim?.() ?? body[c];
  if ('tipo' in body) {
    if (!TIPOS.includes(body.tipo)) throw error400('tipo inválido');
    patch.tipo = body.tipo;
  }
  for (const c of ['duracion_min', 'rpe_sesion']) if (c in body) patch[c] = numOrNull(body[c]);
  for (const c of ['inicio', 'fin', 'rutina_id']) if (c in body) patch[c] = body[c] || null;
  const sb = getSupabaseServer();
  const { error } = await sb.from('sesiones').update(patch).eq('id', id);
  if (error) throw error;
  if ('sets' in body) await guardarSets(sb, id, body.sets);
  const { data: full } = await sb.from('sesiones').select(SEL).eq('id', id).single();
  return full;
}

export async function eliminarSesion(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('sesiones').delete().eq('id', id);
  if (error) throw error;
}
