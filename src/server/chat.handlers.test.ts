// Pruebas del chat soberano (chat.handlers.ts) con Supabase fake en memoria,
// mismo patron que journal.handlers.test.ts. Hermes se dobla con
// setEnviarAHermesChat, asi que aca no hay red: se prueba la maquina de
// estados del run (pendiente -> trabajando -> completado/fallido), las
// validaciones de envio y el candado de un-run-por-conversacion.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  crearConversacion,
  enviarMensaje,
  listarConversaciones,
  obtenerHilo,
  setClienteSupabaseChat,
  setEnviarAHermesChat,
  type Run,
} from './chat.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado {
  conversaciones: Fila[];
  mensajes: Fila[];
  runs: Fila[];
}

function crearClienteFake(estado: Estado): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === 'chat_conversaciones') return estado.conversaciones;
    if (nombre === 'chat_mensajes') return estado.mensajes;
    if (nombre === 'chat_runs') return estado.runs;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function defaults(nombre: string): Fila {
    const ahora = new Date().toISOString();
    if (nombre === 'chat_conversaciones') {
      return {
        id: randomUUID(), titulo: 'Nueva conversacion', perfil: 'vps-default',
        hermes_session_id: null, archivada: false, created_at: ahora, updated_at: ahora,
      };
    }
    if (nombre === 'chat_mensajes') {
      return { id: randomUUID(), created_at: ahora };
    }
    return {
      id: randomUUID(), mensaje_assistant_id: null, estado: 'pendiente', error: null,
      evidencia: {}, iniciado_at: ahora, terminado_at: null,
    };
  }

  function builder(nombre: string) {
    let modo: 'select' | 'insert' | 'update' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila | Fila[] = [];
    let updateValues: Fila = {};
    const ordenes: Array<{ campo: string; asc: boolean }> = [];
    let limite: number | null = null;
    let single = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = tabla(nombre);

      if (modo === 'insert') {
        const rows = Array.isArray(insertRows) ? insertRows : [insertRows];
        const nuevas = rows.map((r) => ({ ...defaults(nombre), ...r }));
        filas.push(...nuevas);
        return { data: single ? nuevas[0] : nuevas, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        if (single) {
          return coincidencias[0]
            ? { data: coincidencias[0], error: null }
            : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
        }
        return { data: coincidencias, error: null };
      }

      let resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      for (const { campo, asc } of [...ordenes].reverse()) {
        resultado = [...resultado].sort((a, b) => {
          const av = String(a[campo] ?? '');
          const bv = String(b[campo] ?? '');
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limite != null) resultado = resultado.slice(0, limite);
      if (single) {
        return resultado[0]
          ? { data: resultado[0], error: null }
          : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      }
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      insert(rows: Fila | Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      update(values: Fila) { modo = 'update'; updateValues = values; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      in(campo: string, valores: unknown[]) { filtros.push((f) => valores.includes(f[campo])); return self; },
      order(campo: string, opts: { ascending: boolean }) { ordenes.push({ campo, asc: opts.ascending }); return self; },
      limit(n: number) { limite = n; return self; },
      single() { single = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };
    return self;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

let estado: Estado;

beforeEach(() => {
  estado = { conversaciones: [], mensajes: [], runs: [] };
  setClienteSupabaseChat(() => crearClienteFake(estado));
  setEnviarAHermesChat(async () => 'respuesta de hermes');
});

test('crearConversacion asigna sesion de Hermes propia', async () => {
  const conv = await crearConversacion('Planes', 'vps-default');
  assert.equal(conv.titulo, 'Planes');
  assert.match(String(conv.hermes_session_id), /^os-chat-/);
  assert.equal((await listarConversaciones()).length, 1);
});

test('enviarMensaje guarda el mensaje, crea run y procesarRun lo completa', async () => {
  const conv = await crearConversacion();
  const { mensaje, run } = await enviarMensaje(conv.id, 'hola hermes');
  assert.equal(mensaje.rol, 'user');
  // El fake comparte la fila en memoria con procesarRun (que ya arranco), asi
  // que el estado puede haber avanzado; en PostgREST real llega 'pendiente'.
  assert.ok(['pendiente', 'trabajando'].includes(run.estado));

  // El fire-and-forget ya corre; se espera a que el run termine.
  await new Promise((r) => setTimeout(r, 20));
  const hilo = await obtenerHilo(conv.id);
  assert.equal(hilo.runActivo, null);
  const roles = hilo.mensajes.map((m) => m.rol);
  assert.deepEqual(roles, ['user', 'assistant']);
  assert.equal(hilo.mensajes[1].contenido, 'respuesta de hermes');
  const runFinal = estado.runs[0] as unknown as Run;
  assert.equal(runFinal.estado, 'completado');
  assert.equal(typeof (runFinal.evidencia as Record<string, unknown>).duracion_ms, 'number');
});

test('si Hermes falla, el run queda fallido con el error y sin mensaje assistant', async () => {
  setEnviarAHermesChat(async () => {
    throw new Error('Hermes HTTP 502');
  });
  const conv = await crearConversacion();
  await enviarMensaje(conv.id, 'hola');
  await new Promise((r) => setTimeout(r, 20));
  const runFinal = estado.runs[0] as unknown as Run;
  assert.equal(runFinal.estado, 'fallido');
  assert.match(String(runFinal.error), /502/);
  assert.equal(estado.mensajes.filter((m) => m.rol === 'assistant').length, 0);
});

test('no se puede enviar mientras hay un run activo (candado tipo Telegram)', async () => {
  // Hermes lento: el primer run queda 'trabajando' durante el segundo envio.
  setEnviarAHermesChat(() => new Promise((r) => setTimeout(() => r('tarde'), 200)));
  const conv = await crearConversacion();
  await enviarMensaje(conv.id, 'primero');
  await assert.rejects(enviarMensaje(conv.id, 'segundo'), /sigue trabajando/);
});

test('validaciones de contenido', async () => {
  const conv = await crearConversacion();
  await assert.rejects(enviarMensaje(conv.id, '   '), /requerido/);
  await assert.rejects(enviarMensaje(conv.id, 'x'.repeat(5000)), /demasiado largo/);
  await assert.rejects(enviarMensaje(randomUUID(), 'hola'), /no encontrada/);
});

test('run huerfano se marca fallido al leer el hilo', async () => {
  const conv = await crearConversacion();
  const msg = { id: randomUUID(), conversacion_id: conv.id, rol: 'user', contenido: 'x', created_at: new Date().toISOString() };
  estado.mensajes.push(msg);
  estado.runs.push({
    id: randomUUID(), conversacion_id: conv.id, mensaje_user_id: msg.id, mensaje_assistant_id: null,
    estado: 'trabajando', error: null, evidencia: {},
    iniciado_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), terminado_at: null,
  });
  const hilo = await obtenerHilo(conv.id);
  assert.equal(hilo.runActivo, null);
  assert.equal(estado.runs[0].estado, 'fallido');
});

test('titulo automatico con el primer mensaje', async () => {
  const conv = await crearConversacion();
  await enviarMensaje(conv.id, 'revisa mi agenda de la semana');
  const c = estado.conversaciones[0];
  assert.equal(c.titulo, 'revisa mi agenda de la semana');
});
