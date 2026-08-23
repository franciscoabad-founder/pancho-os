// Logica de /api/salud/rutinas, portada de src/pages/api/salud/rutinas.ts.
// Rutinas del modulo Salud (tabla `rutinas`, distinta de gfit_rutinas).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';

const SEL = '*, rutina_ejercicios(*, ejercicio:ejercicios(*))';

// Reescribe la lista de ejercicios de una rutina (borra e inserta).
async function guardarEjercicios(sb: SupabaseClient, rutinaId: string, ejercicios: unknown) {
  if (!Array.isArray(ejercicios)) return;
  await sb.from('rutina_ejercicios').delete().eq('rutina_id', rutinaId);
  if (!ejercicios.length) return;
  const filas = ejercicios.map((e: Record<string, unknown>, i: number) => ({
    rutina_id: rutinaId,
    ejercicio_id: e.ejercicio_id,
    orden: typeof e.orden === 'number' ? e.orden : i,
    sets_plan: Array.isArray(e.sets_plan) ? e.sets_plan : [],
  }));
  const { error } = await sb.from('rutina_ejercicios').insert(filas);
  if (error) throw error;
}

export async function leerRutinas(id: string | null) {
  const sb = getSupabaseServer();
  // Detalle: rutina + ejercicios con datos del ejercicio.
  if (id) {
    const { data, error } = await sb.from('rutinas').select(SEL).eq('id', id).single();
    if (error) throw error;
    return { rutina: data };
  }
  const { data, error } = await sb
    .from('rutinas')
    .select(SEL)
    .eq('archivada', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { rutinas: data ?? [] };
}

export async function crearRutina(body: Record<string, any>) {
  if (!body.nombre?.trim()) throw error400('nombre requerido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('rutinas')
    .insert([{
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      dias: Array.isArray(body.dias) ? body.dias : [],
    }])
    .select()
    .single();
  if (error) throw error;
  await guardarEjercicios(sb, data.id, body.ejercicios);
  // Devuelve la rutina completa.
  const { data: full } = await sb.from('rutinas').select(SEL).eq('id', data.id).single();
  return full ?? data;
}

export async function actualizarRutina(id: string, body: Record<string, any>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of ['nombre', 'descripcion']) {
    if (c in body) patch[c] = typeof body[c] === 'string' ? body[c].trim() || null : body[c];
  }
  if ('dias' in body) patch.dias = Array.isArray(body.dias) ? body.dias : [];
  if ('archivada' in body) patch.archivada = !!body.archivada;
  const sb = getSupabaseServer();
  const { error } = await sb.from('rutinas').update(patch).eq('id', id);
  if (error) throw error;
  if ('ejercicios' in body) await guardarEjercicios(sb, id, body.ejercicios);
  const { data: full } = await sb.from('rutinas').select(SEL).eq('id', id).single();
  return full;
}

export async function eliminarRutina(id: string): Promise<void> {
  const sb = getSupabaseServer();
  // rutina_ejercicios cae por ON DELETE CASCADE.
  const { error } = await sb.from('rutinas').delete().eq('id', id);
  if (error) throw error;
}
