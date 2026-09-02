// Integracion opcional con Google Calendar usando OAuth refresh token.
// No lee archivos de credenciales del workspace ni expone secretos al cliente.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { readEnv } from '../lib/env.ts';
import { etiquetasAgenda } from './agenda.handlers.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const LOCAL_TIMEZONE = 'America/Guayaquil';

export function googleDateTime(value: string): string {
  const raw = value.trim();
  if (!raw) return raw;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(raw)) return raw;
  return `${raw.length === 16 ? `${raw}:00` : raw}-05:00`;
}

export class ErrorAgendaGoogle extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.name = 'ErrorAgendaGoogle'; this.status = status; }
}

export interface GoogleAgendaConfig { clientId: string; clientSecret: string; refreshToken: string; calendarId: string; }

export function googleAgendaConfig(): GoogleAgendaConfig | null {
  const clientId = readEnv('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = readEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
  const refreshToken = readEnv('GOOGLE_CALENDAR_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId: readEnv('GOOGLE_CALENDAR_ID') || 'primary' };
}

async function accessToken(config: GoogleAgendaConfig): Promise<string> {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: 'refresh_token' });
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10_000) });
  const data = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new ErrorAgendaGoogle(data.error_description || `OAuth Google HTTP ${response.status}`);
  return data.access_token;
}

async function googleRequest(config: GoogleAgendaConfig, path: string, init: RequestInit = {}): Promise<any> {
  const token = await accessToken(config);
  const response = await fetch(`${CALENDAR_URL}/${encodeURIComponent(config.calendarId)}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(15_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ErrorAgendaGoogle(`Google Calendar HTTP ${response.status}: ${data?.error?.message || 'error'}`);
  return data;
}

function diaSiguiente(fecha: string): string {
  const date = new Date(`${fecha}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function googleEventBody(event: Record<string, unknown>): Record<string, unknown> {
  const start = event.start as Record<string, unknown> | undefined;
  const end = event.end as Record<string, unknown> | undefined;
  const inicio = start?.dateTime || (start?.date ? `${String(start.date)}T00:00:00-05:00` : '');
  const fin = end?.dateTime || (end?.date ? `${String(end.date)}T00:00:00-05:00` : '');
  const privateProperties = event.extendedProperties && typeof event.extendedProperties === 'object'
    ? (event.extendedProperties as Record<string, unknown>).private
    : undefined;
  const rawTags = privateProperties && typeof privateProperties === 'object'
    ? (privateProperties as Record<string, unknown>).pancho_os_tags
    : undefined;
  return {
    titulo: String(event.summary || 'Sin título'),
    fecha: String(inicio),
    fin: String(fin) || null,
    ubicacion: typeof event.location === 'string' ? event.location : null,
    resumen: typeof event.description === 'string' ? event.description : null,
    etiquetas: etiquetasAgenda(rawTags),
  };
}

export function googleEventPayload(local: Record<string, unknown>): Record<string, unknown> {
  const inicio = googleDateTime(String(local.fecha));
  const fin = local.fin ? googleDateTime(String(local.fin)) : new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString();
  const etiquetas = etiquetasAgenda(local.etiquetas);
  return {
    summary: local.titulo,
    description: local.resumen || undefined,
    location: local.ubicacion || undefined,
    start: { dateTime: inicio, timeZone: LOCAL_TIMEZONE },
    end: { dateTime: fin, timeZone: LOCAL_TIMEZONE },
    extendedProperties: { private: { pancho_os_tags: etiquetas.join(',') } },
  };
}

function tituloComparable(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Evita crear por segunda vez un evento que ya vino de Google antes de que
 * tuviera google_event_id. Solo vincula coincidencias exactas de título e
 * instante, de modo que dos bloques distintos no se fusionan por accidente.
 */
export function esMismoEventoAgenda(local: Record<string, unknown>, remoto: Record<string, unknown>): boolean {
  const remotoNormalizado = googleEventBody(remoto);
  const tituloLocal = tituloComparable(local.titulo);
  const tituloRemoto = tituloComparable(remotoNormalizado.titulo);
  if (!tituloLocal || tituloLocal !== tituloRemoto) return false;

  const inicioLocal = new Date(String(local.fecha ?? '')).getTime();
  const inicioRemoto = new Date(String(remotoNormalizado.fecha ?? '')).getTime();
  if (!Number.isFinite(inicioLocal) || inicioLocal !== inicioRemoto) return false;

  const finLocal = local.fin ? new Date(String(local.fin)).getTime() : null;
  const finRemoto = remotoNormalizado.fin ? new Date(String(remotoNormalizado.fin)).getTime() : null;
  return finLocal === finRemoto;
}

export async function syncAgendaGoogle(desde: string, hasta: string, sb: SupabaseClient = getSupabaseServer()): Promise<{ importados: number; exportados: number; omitidos: number }> {
  const config = googleAgendaConfig();
  if (!config) throw new ErrorAgendaGoogle('Google Calendar no configurado: faltan GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET o GOOGLE_CALENDAR_REFRESH_TOKEN', 503);
  const timeMin = `${desde}T00:00:00-05:00`;
  // timeMax en Google Calendar es exclusivo, por eso se usa el inicio del dia siguiente.
  const timeMax = `${diaSiguiente(hasta)}T00:00:00-05:00`;
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', showDeleted: 'true', maxResults: '2500' });
  const eventosRemotos: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;
  for (let pagina = 0; pagina < 50; pagina++) {
    if (pageToken) params.set('pageToken', pageToken); else params.delete('pageToken');
    const remote = await googleRequest(config, `/events?${params}`) as { items?: Array<Record<string, unknown>>; nextPageToken?: string };
    eventosRemotos.push(...(remote.items ?? []));
    if (!remote.nextPageToken) break;
    pageToken = remote.nextPageToken;
  }
  let importados = 0;
  let exportados = 0;
  let omitidos = 0;

  const googleIds = eventosRemotos.map((e) => String(e.id)).filter(Boolean);
  const localByGoogleId = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < googleIds.length; i += 500) {
    const chunk = googleIds.slice(i, i + 500);
    const { data: localsChunk, error: lookupError } = await sb.from('reuniones').select('*').in('google_event_id', chunk);
    if (lookupError) throw lookupError;
    for (const loc of localsChunk ?? []) {
      if (loc.google_event_id) localByGoogleId.set(String(loc.google_event_id), loc as Record<string, unknown>);
    }
  }

  const toDeleteGoogleIds: string[] = [];
  const toDeleteLocalIds: string[] = [];
  const toUpdateMeta: Array<Record<string, unknown>> = [];
  const toUpdateFull: Array<Record<string, unknown>> = [];
  const toInsert: Array<Record<string, unknown>> = [];

  for (const event of eventosRemotos) {
    if (!event.id) continue;
    const local = localByGoogleId.get(String(event.id));

    if (event.status === 'cancelled') {
      toDeleteGoogleIds.push(String(event.id));
      continue;
    }
    if (local?.google_deleted_at) {
      await googleRequest(config, `/events/${encodeURIComponent(String(event.id))}`, { method: 'DELETE' });
      toDeleteLocalIds.push(String(local.id));
      exportados++;
      continue;
    }
    const body = googleEventBody(event);
    if (!body.fecha) { omitidos++; continue; }
    if (local) {
      if (local.google_dirty_at) {
        const actualizado = await googleRequest(config, `/events/${encodeURIComponent(String(event.id))}`, { method: 'PATCH', body: JSON.stringify(googleEventPayload(local)) }) as Record<string, unknown>;
        toUpdateMeta.push({ id: local.id, fuente: 'google_calendar', google_etag: actualizado.etag ?? null, google_updated_at: actualizado.updated ?? null, google_dirty_at: null });
        exportados++;
        continue;
      }
      toUpdateFull.push({ id: local.id, ...body, fuente: 'google_calendar', google_etag: event.etag ?? null, google_updated_at: event.updated ?? null, google_dirty_at: null, google_deleted_at: null });
    } else {
      toInsert.push({ ...body, fuente: 'google_calendar', google_event_id: String(event.id), google_etag: event.etag ?? null, google_updated_at: event.updated ?? null });
      importados++;
    }
  }

  if (toDeleteGoogleIds.length > 0) {
    for (let i = 0; i < toDeleteGoogleIds.length; i += 500) {
      const chunk = toDeleteGoogleIds.slice(i, i + 500);
      const { error } = await sb.from('reuniones').delete().in('google_event_id', chunk);
      if (error) throw error;
    }
  }

  if (toDeleteLocalIds.length > 0) {
    for (let i = 0; i < toDeleteLocalIds.length; i += 500) {
      const chunk = toDeleteLocalIds.slice(i, i + 500);
      const { error } = await sb.from('reuniones').delete().in('id', chunk);
      if (error) throw error;
    }
  }

  if (toUpdateMeta.length > 0) {
    for (let i = 0; i < toUpdateMeta.length; i += 500) {
      const chunk = toUpdateMeta.slice(i, i + 500);
      const { error } = await sb.from('reuniones').upsert(chunk);
      if (error) throw error;
    }
  }

  if (toUpdateFull.length > 0) {
    for (let i = 0; i < toUpdateFull.length; i += 500) {
      const chunk = toUpdateFull.slice(i, i + 500);
      const { error } = await sb.from('reuniones').upsert(chunk);
      if (error) throw error;
    }
  }

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error } = await sb.from('reuniones').insert(chunk);
      if (error) throw error;
    }
  }

  const { data: locales, error: localError } = await sb.from('reuniones').select('*').gte('fecha', `${desde}T00:00:00-05:00`).lt('fecha', `${diaSiguiente(hasta)}T00:00:00-05:00`).is('google_event_id', null).is('google_deleted_at', null);
  if (localError) throw localError;
  for (const local of locales ?? []) {
    const existente = eventosRemotos.find((remoto) => remoto.id && remoto.status !== 'cancelled' && esMismoEventoAgenda(local as Record<string, unknown>, remoto));
    if (existente) {
      const { error } = await sb.from('reuniones').update({ fuente: 'google_calendar', google_event_id: String(existente.id), google_etag: existente.etag ?? null, google_updated_at: existente.updated ?? null, google_dirty_at: null }).eq('id', local.id);
      if (error) throw error;
      omitidos++;
      continue;
    }
    const event = await googleRequest(config, '/events', { method: 'POST', body: JSON.stringify(googleEventPayload(local as Record<string, unknown>)) }) as Record<string, unknown>;
    const { error } = await sb.from('reuniones').update({ fuente: 'google_calendar', google_event_id: event.id, google_etag: event.etag ?? null, google_updated_at: event.updated ?? null }).eq('id', local.id);
    if (error) throw error;
    exportados++;
  }
  return { importados, exportados, omitidos };
}
