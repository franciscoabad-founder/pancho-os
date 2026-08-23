// Logica de negocio de agenda, extraida de src/pages/api/agenda.ts.
// Mantiene el contrato de eventos con inicio/fin ISO que espera el UI.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from '../lib/salud/apiHelpers.ts';

export interface Evento {
  id: string;
  titulo: string;
  inicio: string | null;
  fin: string | null;
  ubicacion?: string;
  descripcion?: string;
  brain_slug?: string;
  fuente?: string;
}

export type CuerpoEvento = Record<string, unknown>;

export class ErrorAgenda extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErrorAgenda';
    this.status = status;
  }
}

const CAMPOS = ['titulo', 'fecha', 'fin', 'ubicacion', 'resumen', 'brain_slug'] as const;

function textoOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim();
  return limpio || null;
}

function toEvento(reunion: Record<string, unknown>): Evento {
  return {
    id: String(reunion.id),
    titulo: String(reunion.titulo ?? ''),
    inicio: reunion.fecha ? String(reunion.fecha) : null,
    fin: reunion.fin ? String(reunion.fin) : null,
    ubicacion: reunion.ubicacion ? String(reunion.ubicacion) : undefined,
    descripcion: reunion.resumen ? String(reunion.resumen) : undefined,
    brain_slug: reunion.brain_slug ? String(reunion.brain_slug) : undefined,
    fuente: reunion.fuente ? String(reunion.fuente) : undefined,
  };
}

export function defaultRango(desde?: string | null, hasta?: string | null) {
  const hoy = hoyGuayaquil();
  const enUnaSemana = new Date();
  enUnaSemana.setDate(enUnaSemana.getDate() + 7);
  return {
    desde: desde || hoy,
    hasta: hasta || enUnaSemana.toISOString().slice(0, 10),
  };
}

export async function listarEventos(
  desde?: string | null,
  hasta?: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Evento[]> {
  const { desde: d, hasta: h } = defaultRango(desde, hasta);
  const { data, error } = await sb
    .from('reuniones')
    .select('*')
    .gte('fecha', `${d}T00:00:00`)
    .lte('fecha', `${h}T23:59:59`)
    .order('fecha', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toEvento(r as Record<string, unknown>));
}

export async function crearEvento(
  body: CuerpoEvento,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Evento> {
  const titulo = textoOpcional(body.titulo);
  if (!titulo) throw new ErrorAgenda('titulo requerido', 400);

  const fecha = body.fecha || body.inicio;
  if (!fecha) throw new ErrorAgenda('fecha requerida', 400);

  const { data, error } = await sb
    .from('reuniones')
    .insert([{
      titulo,
      fecha,
      fin: body.fin ?? null,
      ubicacion: textoOpcional(body.ubicacion),
      resumen: textoOpcional(body.resumen ?? body.descripcion),
      brain_slug: textoOpcional(body.brain_slug),
    }])
    .select()
    .single();
  if (error) throw error;
  return toEvento(data as Record<string, unknown>);
}

export async function actualizarEvento(
  id: string | null,
  body: CuerpoEvento,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Evento> {
  if (!id) throw new ErrorAgenda('id requerido', 400);

  const patch: Record<string, unknown> = {};
  for (const c of CAMPOS) {
    if (c in body) {
      patch[c] = c === 'titulo' ? textoOpcional(body[c]) : body[c];
    }
  }
  if ('descripcion' in body) patch.resumen = textoOpcional(body.descripcion);
  if ('inicio' in body) patch.fecha = body.inicio;

  if (!Object.keys(patch).length) throw new ErrorAgenda('sin campos para actualizar', 400);

  const { data, error } = await sb.from('reuniones').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return toEvento(data as Record<string, unknown>);
}

export async function eliminarEvento(
  id: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<void> {
  if (!id) throw new ErrorAgenda('id requerido', 400);
  const { error } = await sb.from('reuniones').delete().eq('id', id);
  if (error) throw error;
}
