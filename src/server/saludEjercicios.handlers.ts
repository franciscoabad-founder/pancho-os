// Logica de /api/salud/ejercicios, portada de
// src/pages/api/salud/ejercicios.ts. Catalogo propio de ejercicios (tabla
// `ejercicios`, distinta de ejercicios_catalogo que usa GFIT).

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';

const PATRONES = ['push_h', 'push_v', 'pull_h', 'pull_v', 'squat', 'hinge', 'core', 'otro'];

export async function buscarEjercicios(params: {
  q: string | null;
  grupo: string | null;
  patron: string | null;
}) {
  const sb = getSupabaseServer();
  // RPC buscar_ejercicios (unaccent, parametrizado): busca en nombre/nombre_en y filtra
  // por grupo/patrón. Insensible a acentos y sin romper términos con paréntesis.
  const { data, error } = await sb.rpc('buscar_ejercicios', {
    term: params.q, p_grupo: params.grupo, p_patron: params.patron, lim: 500,
  });
  if (error) throw error;
  return data ?? [];
}

export async function crearEjercicio(body: Record<string, any>) {
  if (!body.nombre?.trim()) throw error400('nombre requerido');
  if (body.patron && !PATRONES.includes(body.patron)) throw error400('patron inválido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('ejercicios')
    .insert([{
      nombre: body.nombre.trim(),
      nombre_en: body.nombre_en?.trim() || null,
      grupo_muscular_primario: body.grupo_muscular_primario?.trim() || null,
      secundarios: Array.isArray(body.secundarios) ? body.secundarios : [],
      patron: body.patron || null,
      equipamiento: body.equipamiento?.trim() || null,
      instrucciones: body.instrucciones?.trim() || null,
      media_url: body.media_url?.trim() || null,
      fuente: 'personal',
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarEjercicio(id: string, body: Record<string, any>) {
  if (body.patron && !PATRONES.includes(body.patron)) throw error400('patron inválido');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of ['nombre', 'nombre_en', 'grupo_muscular_primario', 'patron', 'equipamiento', 'instrucciones', 'media_url']) {
    if (c in body) patch[c] = typeof body[c] === 'string' ? body[c].trim() || null : body[c];
  }
  if ('secundarios' in body) patch.secundarios = Array.isArray(body.secundarios) ? body.secundarios : [];
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('ejercicios').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarEjercicio(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('ejercicios').delete().eq('id', id);
  if (error) throw error;
}
