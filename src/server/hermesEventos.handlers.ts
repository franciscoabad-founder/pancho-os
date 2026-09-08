// Buzon de eventos que Hermes le empuja al OS (F4, tabla hermes_eventos).
//
// Es la via que faltaba. Con F1..F3 el OS siempre iniciaba la conversacion: si
// Hermes terminaba algo en background no habia forma de avisar. Aca Hermes
// hace POST /api/hermes/eventos y el OS decide que hacer con eso.
//
// Dos cosas pasan al registrar un evento:
//   1. Siempre se guarda la fila cruda. Un evento que no matchea ningun tema
//      NO es un error: queda suelto y la campana lo muestra igual.
//   2. Si el evento trae la clave (session_key) o la sesion (session_id) de un
//      tema del OS, ese tema se marca con `ultimo_evento`. Y si ademas trae
//      texto de asistente y el tema no tiene un run en vuelo, el texto entra
//      al hilo como mensaje 'assistant': eso es el mensaje proactivo.
//
// El candado del run activo importa: si Hermes esta contestando un turno en
// vivo por streaming, insertar aca un mensaje del assistant duplicaria la
// respuesta en el hilo. Ante la duda, el evento queda registrado y el hilo
// intacto.
//
// Mismo patron de seam que el resto de los handlers del repo: el cliente de
// Supabase entra por setClienteSupabaseEventos y los tests corren en memoria.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { validarPerfilHermes } from '../os/lib/perfilesHermes.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseEventos(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

/** Limite de caracteres del mensaje proactivo que se inserta en el hilo. */
export const MAX_LARGO_CONTENIDO = 20_000;

export interface EventoHermesFila {
  id: string;
  perfil_hermes: string | null;
  session_id: string | null;
  session_key: string | null;
  tipo: string;
  titulo: string | null;
  payload: Record<string, unknown>;
  leido: boolean;
  created_at: string;
}

export interface ResultadoRegistro {
  evento: EventoHermesFila;
  /** Id del tema del OS al que se pego el evento, o null si quedo suelto. */
  conversacion_id: string | null;
  /** true si ademas se inserto un mensaje proactivo en el hilo. */
  mensaje_insertado: boolean;
}

function fallar(msg: string): never {
  throw new Error(msg);
}

function texto(valor: unknown): string | null {
  const s = typeof valor === 'string' ? valor.trim() : '';
  return s ? s : null;
}

/**
 * Guarda un evento de Hermes y, si corresponde, lo engancha a un tema del OS.
 *
 * `payload` guarda el cuerpo COMPLETO tal como llego: los campos de arriba son
 * solo lo que el OS necesita para enrutar y mostrar, y Hermes va a seguir
 * agregando cosas sin que haya que migrar la tabla.
 */
export async function registrarEvento(cuerpo: unknown): Promise<ResultadoRegistro> {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) fallar('Cuerpo invalido');
  const p = cuerpo as Record<string, unknown>;

  const tipo = texto(p.tipo) ?? texto(p.type) ?? texto(p.event);
  if (!tipo) fallar('tipo es requerido');

  const sessionKey = texto(p.session_key);
  const sessionId = texto(p.session_id);
  const perfilHermes = p.perfil_hermes === undefined && p.profile === undefined
    ? null
    : validarPerfilHermes(p.perfil_hermes ?? p.profile);

  const sb = clienteActual();
  const { data, error } = await sb
    .from('hermes_eventos')
    .insert({
      perfil_hermes: perfilHermes,
      session_id: sessionId,
      session_key: sessionKey,
      tipo,
      titulo: texto(p.titulo) ?? texto(p.title),
      payload: p,
    })
    .select('*')
    .single();
  if (error) fallar(`registrar evento: ${error.message}`);
  const evento = data as EventoHermesFila;

  const conversacion = await buscarConversacion(sb, sessionKey, sessionId);
  if (!conversacion) return { evento, conversacion_id: null, mensaje_insertado: false };

  await sb
    .from('chat_conversaciones')
    .update({
      ultimo_evento: { id: evento.id, tipo, titulo: evento.titulo, created_at: evento.created_at },
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversacion.id);

  const contenido = texto(p.content) ?? texto(p.contenido);
  const insertado = contenido ? await insertarProactivo(sb, conversacion.id, contenido) : false;
  return { evento, conversacion_id: conversacion.id, mensaje_insertado: insertado };
}

async function buscarConversacion(
  sb: SupabaseClient,
  sessionKey: string | null,
  sessionId: string | null,
): Promise<{ id: string } | null> {
  // La session_key manda: es la que sobrevive a F3 (un tema vinculado a un
  // topic comparte key con el topic, pero su hermes_session_id sigue siendo
  // el propio del OS).
  for (const [campo, valor] of [['session_key', sessionKey], ['hermes_session_id', sessionId]] as const) {
    if (!valor) continue;
    const { data } = await sb
      .from('chat_conversaciones')
      .select('id')
      .eq(campo, valor)
      .limit(1);
    const fila = (data ?? [])[0] as { id: string } | undefined;
    if (fila) return fila;
  }
  return null;
}

/**
 * Inserta el mensaje proactivo, salvo que el tema tenga un run en vuelo.
 *
 * Con un run activo el texto del assistant ya va a llegar por el camino
 * normal (streaming o polling); meterlo aca lo duplicaria en el hilo.
 */
async function insertarProactivo(sb: SupabaseClient, conversacionId: string, contenido: string): Promise<boolean> {
  const { data: activos } = await sb
    .from('chat_runs')
    .select('id')
    .eq('conversacion_id', conversacionId)
    .in('estado', ['pendiente', 'trabajando'])
    .limit(1);
  if ((activos ?? []).length > 0) return false;

  const { error } = await sb
    .from('chat_mensajes')
    .insert({ conversacion_id: conversacionId, rol: 'assistant', contenido: contenido.slice(0, MAX_LARGO_CONTENIDO) });
  return !error;
}

export interface FiltroEventos {
  /** undefined = todos; true/false filtra por estado de lectura. */
  leido?: boolean;
  limite?: number;
}

export const LIMITE_EVENTOS = 50;

export async function listarEventos(filtro: FiltroEventos = {}): Promise<EventoHermesFila[]> {
  const sb = clienteActual();
  let q = sb.from('hermes_eventos').select('*');
  if (filtro.leido !== undefined) q = q.eq('leido', filtro.leido);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(filtro.limite ?? LIMITE_EVENTOS, 1), 200));
  if (error) fallar(`hermes_eventos: ${error.message}`);
  return (data ?? []) as EventoHermesFila[];
}

export async function marcarLeido(id: unknown): Promise<EventoHermesFila> {
  const eventoId = texto(id);
  if (!eventoId) fallar('id es requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('hermes_eventos')
    .update({ leido: true })
    .eq('id', eventoId)
    .select('*')
    .single();
  if (error || !data) fallar('Evento no encontrado');
  return data as EventoHermesFila;
}
