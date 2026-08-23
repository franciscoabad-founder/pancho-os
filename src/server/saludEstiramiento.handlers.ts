// Logica de /api/salud/estiramiento, portada de
// src/pages/api/salud/estiramiento.ts. Rutinas de estiramiento con pasos
// guardados como JSON en la propia fila.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';

export async function listarRutinasEstiramiento() {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('rutinas_estiramiento')
    .select('*')
    .eq('archivada', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function crearRutinaEstiramiento(body: Record<string, any>) {
  if (!body.nombre?.trim()) throw error400('nombre requerido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('rutinas_estiramiento')
    .insert([{
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      pasos: Array.isArray(body.pasos) ? body.pasos : [],
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarRutinaEstiramiento(id: string, body: Record<string, any>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of ['nombre', 'descripcion']) if (c in body) patch[c] = body[c]?.trim?.() || null;
  if ('pasos' in body) patch.pasos = Array.isArray(body.pasos) ? body.pasos : [];
  if ('archivada' in body) patch.archivada = !!body.archivada;
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('rutinas_estiramiento').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarRutinaEstiramiento(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('rutinas_estiramiento').delete().eq('id', id);
  if (error) throw error;
}
