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
  etiquetas?: string[];
  google_event_id?: string;
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
const TZ = 'America/Guayaquil';

function columnaAgendaNuevaAusente(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === '42703' || /column .* does not exist/i.test(String(e?.message || error));
}

function textoOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim();
  return limpio || null;
}

export function etiquetasAgenda(valor: unknown): string[] {
  const entrada = Array.isArray(valor) ? valor : typeof valor === 'string' ? valor.split(',') : [];
  return [...new Set(entrada
    .map((etiqueta) => String(etiqueta).trim().toLowerCase())
    .filter((etiqueta) => etiqueta && etiqueta.length <= 40)
  )].slice(0, 12);
}

/** Convierte datetime-local de la UI a un instante inequívoco en Ecuador. */
export function normalizarFechaAgenda(valor: unknown): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const raw = String(valor).trim();
  const conZona = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;
  const local = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?$/;
  const normalizada = conZona.test(raw) ? raw : local.test(raw) ? `${raw.length === 16 ? `${raw}:00` : raw}-05:00` : null;
  if (!normalizada || Number.isNaN(new Date(normalizada).getTime())) throw new ErrorAgenda('fecha inválida, usa fecha y hora ISO', 400);
  return normalizada;
}

function sumarDias(fecha: string, dias: number): string {
  const date = new Date(`${fecha}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
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
    etiquetas: etiquetasAgenda(reunion.etiquetas),
    google_event_id: reunion.google_event_id ? String(reunion.google_event_id) : undefined,
  };
}

export function defaultRango(desde?: string | null, hasta?: string | null, ahora = new Date()) {
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: TZ });
  return {
    desde: desde || hoy,
    // Dos semanas completas muestran sabado y domingo, incluso sin eventos.
    hasta: hasta || sumarDias(hoy, 13),
  };
}

export async function listarEventos(
  desde?: string | null,
  hasta?: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Evento[]> {
  const { desde: d, hasta: h } = defaultRango(desde, hasta);
  const consulta = sb
    .from('reuniones')
    .select('*')
    .gte('fecha', `${d}T00:00:00-05:00`)
    .lt('fecha', `${sumarDias(h, 1)}T00:00:00-05:00`)
    .is('google_deleted_at', null)
    .order('fecha', { ascending: true });
  let resultado = await consulta;
  // Permite desplegar la pantalla de dias antes de aplicar la migracion.
  if (resultado.error && columnaAgendaNuevaAusente(resultado.error)) {
    resultado = await sb.from('reuniones').select('*').gte('fecha', `${d}T00:00:00-05:00`).lt('fecha', `${sumarDias(h, 1)}T00:00:00-05:00`).order('fecha', { ascending: true });
  }
  if (resultado.error) throw resultado.error;
  return (resultado.data ?? []).map((r) => toEvento(r as Record<string, unknown>));
}

export async function crearEvento(
  body: CuerpoEvento,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<Evento> {
  const titulo = textoOpcional(body.titulo);
  if (!titulo) throw new ErrorAgenda('titulo requerido', 400);

  const fecha = normalizarFechaAgenda(body.fecha || body.inicio);
  if (!fecha) throw new ErrorAgenda('fecha requerida', 400);
  const fin = normalizarFechaAgenda(body.fin);
  if (fin && new Date(fin) < new Date(fecha)) throw new ErrorAgenda('fin no puede ser anterior al inicio', 400);

  const payload = {
    titulo,
    fecha,
    fin,
    ubicacion: textoOpcional(body.ubicacion),
    resumen: textoOpcional(body.resumen ?? body.descripcion),
    brain_slug: textoOpcional(body.brain_slug),
    etiquetas: etiquetasAgenda(body.etiquetas ?? body.tags),
  };
  let resultado = await sb
    .from('reuniones')
    .insert([payload])
    .select()
    .single();
  if (resultado.error && columnaAgendaNuevaAusente(resultado.error)) {
    const { etiquetas: _etiquetas, ...legacyPayload } = payload;
    resultado = await sb.from('reuniones').insert([legacyPayload]).select().single();
  }
  if (resultado.error) throw resultado.error;
  return toEvento(resultado.data as Record<string, unknown>);
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
      patch[c] = c === 'titulo' ? textoOpcional(body[c]) : (c === 'fecha' || c === 'fin' ? normalizarFechaAgenda(body[c]) : body[c]);
    }
  }
  if ('descripcion' in body) patch.resumen = textoOpcional(body.descripcion);
  if ('inicio' in body) patch.fecha = normalizarFechaAgenda(body.inicio);
  if ('etiquetas' in body || 'tags' in body) patch.etiquetas = etiquetasAgenda(body.etiquetas ?? body.tags);
  if (patch.fecha && patch.fin && new Date(String(patch.fin)) < new Date(String(patch.fecha))) throw new ErrorAgenda('fin no puede ser anterior al inicio', 400);

  if (!Object.keys(patch).length) throw new ErrorAgenda('sin campos para actualizar', 400);

  // No se toca Google desde una edicion local. Se deja una marca para que el
  // siguiente sync manual propague el cambio sin que una importacion lo pise.
  patch.google_dirty_at = new Date().toISOString();

  let resultado = await sb.from('reuniones').update(patch).eq('id', id).select().single();
  if (resultado.error && columnaAgendaNuevaAusente(resultado.error)) {
    const { etiquetas: _etiquetas, google_dirty_at: _dirty, ...legacyPatch } = patch;
    resultado = await sb.from('reuniones').update(legacyPatch).eq('id', id).select().single();
  }
  if (resultado.error) throw resultado.error;
  return toEvento(resultado.data as Record<string, unknown>);
}

export async function eliminarEvento(
  id: string | null,
  sb: SupabaseClient = getSupabaseServer(),
): Promise<void> {
  if (!id) throw new ErrorAgenda('id requerido', 400);
  const { data: actual, error: lecturaError } = await sb.from('reuniones').select('google_event_id').eq('id', id).maybeSingle();
  if (lecturaError && columnaAgendaNuevaAusente(lecturaError)) {
    const { error } = await sb.from('reuniones').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  if (lecturaError) throw lecturaError;
  const query = actual?.google_event_id
    ? sb.from('reuniones').update({ google_deleted_at: new Date().toISOString() }).eq('id', id)
    : sb.from('reuniones').delete().eq('id', id);
  const { error } = await query;
  if (error) throw error;
}
