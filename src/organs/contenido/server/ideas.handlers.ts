// Logica de negocio de os_contenido_ideas: el pipeline editorial (ideas,
// formato, repurposing, plataformas y estado).
//
// Este archivo ES src/pages/api/contenido.ts (por eso conserva su historia de
// git), portado de Astro al patron que ya usa src/server/tareas.handlers.ts:
// el endpoint de Astro mezclaba tres cosas en un solo lugar (validacion +
// Supabase, lectura del APIContext, y construccion del Response). Aca queda
// SOLO la primera. Nada de este modulo conoce Astro, TanStack Start, Request ni
// Response, asi que lo pueden consumir tanto la server route
// (src/routes/api/contenido.ts) como una server function de loader mas
// adelante, sin duplicar reglas.
//
// Las reglas se portaron literales, no reescritas: mismos campos permitidos,
// misma normalizacion de arrays, mismo trato del titulo, mismo fallback de
// url_referencia/transcript para sobrevivir a la migracion 20260722 sin
// aplicar, y los mismos codigos HTTP (400 / 502) que devolvia Astro.

import { getSupabaseServer } from '../../../server/supabase.ts';

// Campos que el cliente puede tocar en un PATCH. Lista cerrada: cualquier otra
// clave del cuerpo se ignora en silencio, igual que en la version Astro.
const CAMPOS = [
  'titulo',
  'formato',
  'idea_madre',
  'repurposing',
  'status',
  'plataformas',
  'fecha_target',
  'url_referencia',
  'transcript',
] as const;

const CAMPOS_ARRAY = new Set<string>(['repurposing', 'plataformas']);

export interface Idea {
  id: string;
  titulo: string;
  formato: string | null;
  idea_madre: string | null;
  repurposing: string[];
  status: string;
  plataformas: string[];
  fecha_target: string | null;
  url_referencia?: string | null;
  transcript?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Cuerpo crudo de la peticion: no confiamos en su forma, cada campo se
// normaliza abajo.
export type CuerpoIdea = Record<string, unknown>;

export class ErrorIdeas extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErrorIdeas';
    this.status = status;
  }
}

function asArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/** Lista el pipeline completo, opcionalmente filtrado por estado. */
export async function listarIdeas(status?: string | null): Promise<Idea[]> {
  const sb = getSupabaseServer();
  let query = sb.from('os_contenido_ideas').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Idea[];
}

export async function crearIdea(body: CuerpoIdea): Promise<Idea> {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  if (!titulo) throw new ErrorIdeas('titulo requerido', 400);

  const fila: Record<string, unknown> = {
    titulo,
    formato: body.formato ?? null,
    idea_madre: body.idea_madre ?? null,
    repurposing: asArray(body.repurposing) ?? [],
    status: body.status ?? 'idea',
    plataformas: asArray(body.plataformas) ?? [],
    fecha_target: body.fecha_target || null,
  };

  // Solo si vienen: asi el POST sigue funcionando aunque la migracion
  // 20260722 (url_referencia/transcript) no este aplicada todavia.
  if (typeof body.url_referencia === 'string' && body.url_referencia.trim()) {
    fila.url_referencia = body.url_referencia.trim();
  }
  if (typeof body.transcript === 'string' && body.transcript.trim()) {
    fila.transcript = body.transcript.trim();
  }

  const sb = getSupabaseServer();
  const { data, error } = await sb.from('os_contenido_ideas').insert([fila]).select().single();
  if (error) throw error;
  return data as Idea;
}

export async function actualizarIdea(id: string | null, body: CuerpoIdea): Promise<Idea> {
  if (!id) throw new ErrorIdeas('id requerido', 400);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of CAMPOS) {
    if (!(c in body)) continue;
    patch[c] = CAMPOS_ARRAY.has(c) ? asArray(body[c]) : body[c];
  }

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('os_contenido_ideas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Idea;
}

export async function eliminarIdea(id: string | null): Promise<void> {
  if (!id) throw new ErrorIdeas('id requerido', 400);
  const sb = getSupabaseServer();
  const { error } = await sb.from('os_contenido_ideas').delete().eq('id', id);
  if (error) throw error;
}
