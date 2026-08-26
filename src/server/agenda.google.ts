// Integracion opcional con Google Calendar usando OAuth refresh token.
// No lee archivos de credenciales del workspace ni expone secretos al cliente.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { readEnv } from '../lib/env.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const LOCAL_TIMEZONE = 'America/Guayaquil';

function googleDateTime(value: string): string {
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

function googleEventBody(event: Record<string, unknown>): Record<string, unknown> {
  const start = event.start as Record<string, unknown> | undefined;
  const end = event.end as Record<string, unknown> | undefined;
  return {
    titulo: String(event.summary || 'Sin título'),
    fecha: String(start?.dateTime || start?.date || ''),
    fin: String(end?.dateTime || end?.date || '') || null,
    ubicacion: typeof event.location === 'string' ? event.location : null,
    resumen: typeof event.description === 'string' ? event.description : null,
  };
}

export async function syncAgendaGoogle(desde: string, hasta: string, sb: SupabaseClient = getSupabaseServer()): Promise<{ importados: number; exportados: number; omitidos: number }> {
  const config = googleAgendaConfig();
  if (!config) throw new ErrorAgendaGoogle('Google Calendar no configurado: faltan GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET o GOOGLE_CALENDAR_REFRESH_TOKEN', 503);
  const timeMin = `${desde}T00:00:00Z`;
  const timeMax = `${hasta}T23:59:59Z`;
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '2500' });
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

  for (const event of eventosRemotos) {
    if (!event.id) continue;
    if (event.status === 'cancelled') {
      const { error } = await sb.from('reuniones').delete().eq('google_event_id', String(event.id));
      if (error) throw error;
      continue;
    }
    const body = googleEventBody(event);
    if (!body.fecha) { omitidos++; continue; }
    const { data: local } = await sb.from('reuniones').select('id').eq('google_event_id', String(event.id)).maybeSingle();
    if (local) {
      const { error } = await sb.from('reuniones').update({ ...body, fuente: 'google_calendar', google_etag: event.etag ?? null, google_updated_at: event.updated ?? null }).eq('id', local.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('reuniones').insert([{ ...body, fuente: 'google_calendar', google_event_id: String(event.id), google_etag: event.etag ?? null, google_updated_at: event.updated ?? null }]);
      if (error) throw error;
      importados++;
    }
  }

  const { data: locales, error: localError } = await sb.from('reuniones').select('*').gte('fecha', `${desde}T00:00:00`).lte('fecha', `${hasta}T23:59:59`).is('google_event_id', null);
  if (localError) throw localError;
  for (const local of locales ?? []) {
    const inicio = googleDateTime(String(local.fecha));
    const fin = local.fin ? googleDateTime(String(local.fin)) : new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString();
    const body = { summary: local.titulo, description: local.resumen || undefined, location: local.ubicacion || undefined, start: { dateTime: inicio, timeZone: LOCAL_TIMEZONE }, end: { dateTime: fin, timeZone: LOCAL_TIMEZONE } };
    const event = await googleRequest(config, '/events', { method: 'POST', body: JSON.stringify(body) }) as Record<string, unknown>;
    const { error } = await sb.from('reuniones').update({ fuente: 'google_calendar', google_event_id: event.id, google_etag: event.etag ?? null, google_updated_at: event.updated ?? null }).eq('id', local.id);
    if (error) throw error;
    exportados++;
  }
  return { importados, exportados, omitidos };
}
