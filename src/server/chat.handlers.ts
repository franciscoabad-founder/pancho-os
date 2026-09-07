// Chat soberano del OS (tablas chat_conversaciones / chat_mensajes / chat_runs).
//
// Implementa la decision os-chat-telegram-soberano (brain, 30 ago 2026): el OS
// guarda su propio hilo visible y procesa contra Hermes EN SEGUNDO PLANO, en
// vez del proxy sincronico de taski.handlers.ts (que revienta por timeout
// cuando Hermes tarda mas de 60s, y Hermes tarda 85s+ con frecuencia).
//
// Flujo: enviarMensaje guarda el mensaje del usuario + crea un run 'pendiente'
// y dispara procesarRun sin await (fire-and-forget dentro del server Node de
// PM2, que es long-running). El frontend hace polling de obtenerHilo hasta ver
// el run 'completado' con la respuesta, o 'fallido' con el error.
//
// Si el server se reinicia con un run en vuelo, ese run queda 'trabajando'
// para siempre: obtenerHilo lo marca 'fallido' pasado RUN_TIMEOUT_MS. Honesto
// y simple; el usuario reintenta con un boton.
//
// F1 (streaming) agrega un SEGUNDO camino de envio, no un reemplazo:
// enviarMensajeStream devuelve un ReadableStream con los eventos del turno en
// vivo. Los dos caminos comparten prepararTurno() (validaciones, candado de un
// run por conversacion, mensaje del usuario y run) y los dos persisten igual.
// La persistencia nunca depende del cliente: si el navegador se va, se deja de
// emitir pero el turno termina y se guarda.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import {
  crearSesionTaski,
  enviarATaski,
  renombrarSesionHermes,
  streamTaski,
  validarPerfil,
  MAX_LARGO_MENSAJE,
  type EventoHermes,
  type OpcionesStreamTaski,
} from './taski.handlers.ts';
import { formatearSse } from '../os/lib/sse.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseChat(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

// Seam para tests: reemplaza la llamada real a Hermes.
type EnviarAHermes = (mensaje: string, sessionId: string, perfil: string, timeoutMs?: number) => Promise<string>;
let enviarAHermesActual: EnviarAHermes = enviarATaski;

export function setEnviarAHermesChat(fn: EnviarAHermes | null): void {
  enviarAHermesActual = fn ?? enviarATaski;
}

// Seam para tests del camino con streaming. Misma idea que el de arriba, pero
// con el callback de eventos: el doble decide que eventos emite.
type StreamAHermes = (
  mensaje: string,
  sessionId: string,
  opts: OpcionesStreamTaski,
  onEvento: (evento: EventoHermes) => void,
) => Promise<string>;
let streamAHermesActual: StreamAHermes = streamTaski;

export function setStreamHermesChat(fn: StreamAHermes | null): void {
  streamAHermesActual = fn ?? streamTaski;
}

type CrearSesion = (sessionId: string, titulo: string, perfil: string, sessionKey?: string) => Promise<void>;
let crearSesionActual: CrearSesion = crearSesionTaski;

export function setCrearSesionHermesChat(fn: CrearSesion | null): void {
  crearSesionActual = fn ?? crearSesionTaski;
}

type RenombrarSesion = (sessionId: string, titulo: string, perfil: string) => Promise<boolean>;
let renombrarSesionActual: RenombrarSesion = renombrarSesionHermes;

export function setRenombrarSesionHermesChat(fn: RenombrarSesion | null): void {
  renombrarSesionActual = fn ?? renombrarSesionHermes;
}

// Hermes puede tardar minutos; el run se declara muerto pasado esto.
export const RUN_TIMEOUT_MS = 5 * 60 * 1000;
export { MAX_LARGO_MENSAJE };

export interface Conversacion {
  id: string;
  titulo: string;
  perfil: string;
  hermes_session_id: string | null;
  archivada: boolean;
  created_at: string;
  updated_at: string;
}

export interface Mensaje {
  id: string;
  conversacion_id: string;
  rol: 'user' | 'assistant' | 'sistema';
  contenido: string;
  created_at: string;
}

export interface Run {
  id: string;
  conversacion_id: string;
  mensaje_user_id: string;
  mensaje_assistant_id: string | null;
  estado: 'pendiente' | 'trabajando' | 'completado' | 'fallido';
  error: string | null;
  evidencia: Record<string, unknown>;
  iniciado_at: string;
  terminado_at: string | null;
}

function fallar(msg: string): never {
  throw new Error(msg);
}

export async function listarConversaciones(): Promise<Conversacion[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('chat_conversaciones')
    .select('*')
    .eq('archivada', false)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) fallar(`chat_conversaciones: ${error.message}`);
  return (data ?? []) as Conversacion[];
}

export async function crearConversacion(tituloRaw?: unknown, perfilRaw?: unknown): Promise<Conversacion> {
  const sb = clienteActual();
  const titulo = String(tituloRaw ?? '').trim() || 'Nueva conversacion';
  const perfil = validarPerfil(typeof perfilRaw === 'string' ? perfilRaw : undefined);
  const { data, error } = await sb
    .from('chat_conversaciones')
    .insert({ titulo, perfil })
    .select('*')
    .single();
  if (error) fallar(`crear conversacion: ${error.message}`);
  const conv = data as Conversacion;
  // La sesion de Hermes es una por conversacion del OS: contexto continuo del
  // lado del agente, hilos separados del lado del usuario. Prefijo os-chat-
  // para distinguirla de la sesion legacy 'pancho-os' del cockpit.
  const { data: conData, error: err2 } = await sb
    .from('chat_conversaciones')
    .update({ hermes_session_id: `os-chat-${conv.id.slice(0, 8)}` })
    .eq('id', conv.id)
    .select('*')
    .single();
  if (err2) fallar(`asignar sesion hermes: ${err2.message}`);
  return conData as Conversacion;
}

export const MAX_LARGO_TITULO = 120;

/**
 * Renombra una conversacion del OS.
 *
 * El titulo automatico solo pisa el valor por defecto 'Nueva conversacion'
 * (ver enviarMensaje), asi que un nombre puesto a mano sobrevive al primer
 * mensaje sin necesidad de una bandera extra. Ademas se replica el nombre a la
 * sesion de Hermes (PATCH /api/sessions/{id}) para que el mismo hilo se vea
 * igual desde la burbuja y el cockpit; si Hermes no acepta el PATCH, el OS se
 * queda con su propio titulo y no se rompe nada.
 */
export async function renombrarConversacion(conversacionId: string, tituloRaw: unknown): Promise<Conversacion> {
  const titulo = String(tituloRaw ?? '').trim();
  if (!titulo) fallar('Titulo requerido');
  if (titulo.length > MAX_LARGO_TITULO) fallar(`Titulo demasiado largo (max ${MAX_LARGO_TITULO})`);

  const sb = clienteActual();
  const { data, error } = await sb
    .from('chat_conversaciones')
    .update({ titulo, updated_at: new Date().toISOString() })
    .eq('id', conversacionId)
    .select('*')
    .single();
  if (error || !data) fallar('Conversacion no encontrada');

  const conv = data as Conversacion;
  const sessionId = conv.hermes_session_id || `os-chat-${conv.id.slice(0, 8)}`;
  await renombrarSesionActual(sessionId, titulo, conv.perfil).catch(() => false);
  return conv;
}

export interface Hilo {
  conversacion: Conversacion;
  mensajes: Mensaje[];
  runActivo: Run | null;
}

export async function obtenerHilo(conversacionId: string): Promise<Hilo> {
  const sb = clienteActual();
  const { data: conv, error: e1 } = await sb
    .from('chat_conversaciones')
    .select('*')
    .eq('id', conversacionId)
    .single();
  if (e1 || !conv) fallar('Conversacion no encontrada');

  const [{ data: mensajes, error: e2 }, { data: runs, error: e3 }] = await Promise.all([
    sb.from('chat_mensajes').select('*').eq('conversacion_id', conversacionId).order('created_at', { ascending: true }).limit(200),
    sb.from('chat_runs').select('*').eq('conversacion_id', conversacionId).in('estado', ['pendiente', 'trabajando']).order('iniciado_at', { ascending: false }).limit(1),
  ]);
  if (e2) fallar(`mensajes: ${e2.message}`);
  if (e3) fallar(`runs: ${e3.message}`);

  let runActivo = (runs?.[0] as Run | undefined) ?? null;

  // Run huerfano (server reiniciado a mitad): declararlo fallido, no colgar la UI.
  if (runActivo && Date.now() - new Date(runActivo.iniciado_at).getTime() > RUN_TIMEOUT_MS) {
    const { data: muerto } = await sb
      .from('chat_runs')
      .update({
        estado: 'fallido',
        error: 'El procesamiento se interrumpio (timeout). Reintenta el mensaje.',
        terminado_at: new Date().toISOString(),
      })
      .eq('id', runActivo.id)
      .in('estado', ['pendiente', 'trabajando'])
      .select('*')
      .single();
    runActivo = muerto ? null : runActivo;
  }

  return {
    conversacion: conv as Conversacion,
    mensajes: (mensajes ?? []) as Mensaje[],
    runActivo,
  };
}

export interface EnvioResultado {
  mensaje: Mensaje;
  run: Run;
}

interface TurnoPreparado extends EnvioResultado {
  conversacion: Conversacion;
  contenido: string;
}

/**
 * Todo lo que hay que hacer ANTES de hablar con Hermes, igual para el camino
 * sincronico (enviarMensaje) y para el de streaming (enviarMensajeStream):
 * validar, respetar el candado de un run por conversacion, guardar el mensaje
 * del usuario, abrir el run y poner titulo automatico.
 *
 * Se extrajo para que el streaming no duplique reglas: si manana cambia el
 * candado o el limite de largo, cambia en un solo lugar.
 */
async function prepararTurno(conversacionId: string, contenidoRaw: unknown): Promise<TurnoPreparado> {
  const contenido = String(contenidoRaw ?? '').trim();
  if (!contenido) fallar('Mensaje requerido');
  if (contenido.length > MAX_LARGO_MENSAJE) fallar(`Mensaje demasiado largo (max ${MAX_LARGO_MENSAJE})`);

  const sb = clienteActual();
  const { data: conv, error: e0 } = await sb
    .from('chat_conversaciones')
    .select('*')
    .eq('id', conversacionId)
    .single();
  if (e0 || !conv) fallar('Conversacion no encontrada');

  // Un solo run activo por conversacion: mientras Hermes piensa, no se encola
  // otro turno (mismo comportamiento que Telegram con un agente ocupado).
  const { data: activos } = await sb
    .from('chat_runs')
    .select('id, iniciado_at')
    .eq('conversacion_id', conversacionId)
    .in('estado', ['pendiente', 'trabajando'])
    .limit(1);
  const activo = activos?.[0] as { iniciado_at: string } | undefined;
  if (activo && Date.now() - new Date(activo.iniciado_at).getTime() <= RUN_TIMEOUT_MS) {
    fallar('Hermes sigue trabajando en el mensaje anterior. Espera la respuesta.');
  }

  const { data: msg, error: e1 } = await sb
    .from('chat_mensajes')
    .insert({ conversacion_id: conversacionId, rol: 'user', contenido })
    .select('*')
    .single();
  if (e1) fallar(`guardar mensaje: ${e1.message}`);

  const { data: run, error: e2 } = await sb
    .from('chat_runs')
    .insert({ conversacion_id: conversacionId, mensaje_user_id: (msg as Mensaje).id, estado: 'pendiente' })
    .select('*')
    .single();
  if (e2) fallar(`crear run: ${e2.message}`);

  // Titulo automatico con el primer mensaje.
  const c = conv as Conversacion;
  const titulo = c.titulo === 'Nueva conversacion' ? contenido.slice(0, 60) : undefined;
  await sb
    .from('chat_conversaciones')
    .update({ updated_at: new Date().toISOString(), ...(titulo ? { titulo } : {}) })
    .eq('id', conversacionId);

  return { mensaje: msg as Mensaje, run: run as Run, conversacion: c, contenido };
}

export async function enviarMensaje(conversacionId: string, contenidoRaw: unknown): Promise<EnvioResultado> {
  const turno = await prepararTurno(conversacionId, contenidoRaw);
  // Fire-and-forget: el POST vuelve ya; el run avanza en segundo plano.
  void procesarRun(turno.run.id, turno.conversacion, turno.contenido);
  return { mensaje: turno.mensaje, run: turno.run };
}

/**
 * Scope de memoria del tema en Hermes (cabecera X-Hermes-Session-Key).
 *
 * En F1 el perfil de Hermes es siempre el default: el OS todavia no modela
 * "perfil de Hermes" aparte de "nodo" (eso es F2), y la clave no depende del
 * titulo a proposito, para que renombrar una conversacion no le borre la
 * memoria al agente.
 */
export function claveSesionTema(conv: Conversacion): string {
  return `os:default:${conv.id.slice(0, 8)}`;
}

function sesionDeConversacion(conv: Conversacion): string {
  return conv.hermes_session_id || `os-chat-${conv.id.slice(0, 8)}`;
}

// Exportada para tests (que la awaitean); en produccion corre sin await.
export async function procesarRun(runId: string, conv: Conversacion, contenido: string): Promise<void> {
  const sb = clienteActual();
  const inicio = Date.now();
  await sb.from('chat_runs').update({ estado: 'trabajando' }).eq('id', runId);

  try {
    const sessionId = sesionDeConversacion(conv);
    // Hermes solo acepta chat sobre sesiones existentes: crearla es idempotente
    // (409 = ya estaba) y barato, asi que se asegura en cada run.
    await crearSesionActual(sessionId, conv.titulo, conv.perfil, claveSesionTema(conv));
    // 4 min de presupuesto: el run corre en background, no bloquea a nadie.
    const respuesta = await enviarAHermesActual(contenido, sessionId, conv.perfil, 240_000);
    const texto = respuesta.trim() || '(Hermes devolvio una respuesta vacia)';

    const { data: msgA, error: eA } = await sb
      .from('chat_mensajes')
      .insert({ conversacion_id: conv.id, rol: 'assistant', contenido: texto })
      .select('*')
      .single();
    if (eA) throw new Error(`guardar respuesta: ${eA.message}`);

    await sb
      .from('chat_runs')
      .update({
        estado: 'completado',
        mensaje_assistant_id: (msgA as Mensaje).id,
        terminado_at: new Date().toISOString(),
        evidencia: {
          duracion_ms: Date.now() - inicio,
          hermes_session_id: sessionId,
          perfil: conv.perfil,
        },
      })
      .eq('id', runId);
    await sb.from('chat_conversaciones').update({ updated_at: new Date().toISOString() }).eq('id', conv.id);
  } catch (err) {
    await sb
      .from('chat_runs')
      .update({
        estado: 'fallido',
        error: err instanceof Error ? err.message : String(err),
        terminado_at: new Date().toISOString(),
        evidencia: { duracion_ms: Date.now() - inicio, perfil: conv.perfil },
      })
      .eq('id', runId);
  }
}

// ---------------------------------------------------------------------------
// Camino con streaming (F1)
// ---------------------------------------------------------------------------
//
// Misma maquina de estados que arriba: el run vive en chat_runs y la respuesta
// final se guarda en chat_mensajes. La diferencia es que el turno tambien se
// va contando en vivo por SSE.
//
// REGLA: la persistencia NO depende del cliente. Si el navegador cierra la
// pestana a mitad del turno, `emitir` deja de escribir (el ReadableStream ya no
// acepta datos) pero procesarRunStream sigue hasta el final y guarda la
// respuesta igual que procesarRun. El stream es presentacion; la verdad del
// transcript sigue siendo la base del OS.

/**
 * Procesa un turno con streaming. `emitir` recibe cada evento que hay que
 * mandarle al cliente; puede ser un no-op si el cliente ya se fue.
 *
 * Exportada para tests (que la awaitean); en produccion la dispara
 * enviarMensajeStream sin await.
 */
export async function procesarRunStream(
  runId: string,
  conv: Conversacion,
  contenido: string,
  emitir: (evento: EventoHermes) => void,
): Promise<void> {
  const sb = clienteActual();
  const inicio = Date.now();
  await sb.from('chat_runs').update({ estado: 'trabajando' }).eq('id', runId);

  const sessionId = sesionDeConversacion(conv);
  const sessionKey = claveSesionTema(conv);

  try {
    await crearSesionActual(sessionId, conv.titulo, conv.perfil, sessionKey);

    const respuesta = await streamAHermesActual(
      contenido,
      sessionId,
      { perfil: validarPerfil(conv.perfil), sessionKey, timeoutMs: 240_000 },
      // El run.completed de Hermes se filtra: el cliente lo usa como senal de
      // "recarga el hilo", y si lo reemitieramos tal cual llegaria ANTES de que
      // el mensaje del assistant este guardado. El OS emite el suyo al final.
      (evento) => {
        if (evento.tipo === 'run.completed') return;
        emitir(evento);
      },
    );
    const texto = respuesta.trim() || '(Hermes devolvio una respuesta vacia)';

    const { data: msgA, error: eA } = await sb
      .from('chat_mensajes')
      .insert({ conversacion_id: conv.id, rol: 'assistant', contenido: texto })
      .select('*')
      .single();
    if (eA) throw new Error(`guardar respuesta: ${eA.message}`);

    await sb
      .from('chat_runs')
      .update({
        estado: 'completado',
        mensaje_assistant_id: (msgA as Mensaje).id,
        terminado_at: new Date().toISOString(),
        evidencia: {
          duracion_ms: Date.now() - inicio,
          hermes_session_id: sessionId,
          session_key: sessionKey,
          perfil: conv.perfil,
          streaming: true,
        },
      })
      .eq('id', runId);
    await sb.from('chat_conversaciones').update({ updated_at: new Date().toISOString() }).eq('id', conv.id);

    emitir({ tipo: 'run.completed', datos: { run_id: runId, mensaje_id: (msgA as Mensaje).id, estado: 'completado' } });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await sb
      .from('chat_runs')
      .update({
        estado: 'fallido',
        error: detalle,
        terminado_at: new Date().toISOString(),
        evidencia: { duracion_ms: Date.now() - inicio, perfil: conv.perfil, streaming: true },
      })
      .eq('id', runId);
    emitir({ tipo: 'error', detalle });
    // Igual se cierra el turno: el cliente tiene que apagar el spinner.
    emitir({ tipo: 'run.completed', datos: { run_id: runId, estado: 'fallido' } });
  }
}

/**
 * Version con streaming de enviarMensaje: devuelve el cuerpo SSE que la ruta
 * /api/chat/:id/stream entrega tal cual.
 *
 * Las validaciones y el 409 de "ya hay un run activo" siguen viviendo en
 * prepararTurno, asi que fallan ANTES de abrir el stream y la ruta las traduce
 * al mismo status de siempre.
 */
export async function enviarMensajeStream(conversacionId: string, contenidoRaw: unknown): Promise<ReadableStream<Uint8Array>> {
  const turno = await prepararTurno(conversacionId, contenidoRaw);
  const codificador = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controlador) {
      let abierto = true;
      const emitir = (evento: EventoHermes) => {
        if (!abierto) return;
        try {
          controlador.enqueue(codificador.encode(formatearSse(evento.tipo, evento)));
        } catch {
          // El cliente se fue. Solo dejamos de emitir: el run sigue vivo.
          abierto = false;
        }
      };

      // Primer frame: el run recien creado, para que el cliente pueda pintar el
      // estado y, si el stream se corta, caer al polling con el id correcto.
      emitir({ tipo: 'run.started', datos: { run: turno.run, mensaje: turno.mensaje } });

      void procesarRunStream(turno.run.id, turno.conversacion, turno.contenido, emitir).finally(() => {
        if (!abierto) return;
        abierto = false;
        try {
          controlador.close();
        } catch {
          // Ya estaba cerrado por cancelacion del cliente.
        }
      });
    },
  });
}
