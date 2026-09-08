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
  claveSesionTema,
  desvincularTopic,
  parsearTopicTelegram,
  vincularTopic,
  crearConversacion,
  enviarMensaje,
  enviarMensajeStream,
  listarConversaciones,
  obtenerHilo,
  renombrarConversacion,
  setClienteSupabaseChat,
  setCrearSesionHermesChat,
  setEnviarAHermesChat,
  setRenombrarSesionHermesChat,
  setStreamHermesChat,
  type Conversacion,
  type Run,
} from './chat.handlers.ts';
import { leerSse } from '../os/lib/sse.ts';

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
        // Defaults de la migracion 20260908000100_temas_hermes.sql.
        perfil_hermes: 'default', session_key: null, topic_telegram: null,
        estado: 'activo', ultimo_evento: {},
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
        // Indice unico parcial (perfil_hermes, topic_telegram) de la migracion
        // 20260908000100. Se simula aca porque F3 depende de que el choque
        // llegue como error 23505 y no como un update silencioso.
        if (nombre === 'chat_conversaciones' && updateValues.topic_telegram) {
          const choque = filas.some(
            (f) =>
              !coincidencias.includes(f) &&
              f.topic_telegram === updateValues.topic_telegram &&
              f.perfil_hermes === (coincidencias[0]?.perfil_hermes ?? null),
          );
          if (choque) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          }
        }
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
  setStreamHermesChat(null);
  setCrearSesionHermesChat(async () => undefined);
  setRenombrarSesionHermesChat(async () => true);
});

test('crearConversacion asigna sesion de Hermes propia', async () => {
  const conv = await crearConversacion('Planes', 'vps-default');
  assert.equal(conv.titulo, 'Planes');
  assert.match(String(conv.hermes_session_id), /^os-chat-/);
  assert.equal((await listarConversaciones()).length, 1);
});

test('crearConversacion persiste el perfil real y su session_key (F2)', async () => {
  const conv = await crearConversacion('Legal', 'vps-default', 'rafik');
  assert.equal(conv.perfil_hermes, 'rafik');
  // El nodo sigue siendo el otro eje y no se toca.
  assert.equal(conv.perfil, 'vps-default');
  // La clave de memoria lleva el perfil real, no el nodo.
  assert.equal(conv.session_key, `os:rafik:${conv.id.slice(0, 8)}`);
  assert.equal(claveSesionTema(conv), conv.session_key);
});

test('crearConversacion sin perfil real cae a Alfred, como antes de F2', async () => {
  const conv = await crearConversacion('Sin perfil');
  assert.equal(conv.perfil_hermes, 'default');
  assert.equal(conv.session_key, `os:default:${conv.id.slice(0, 8)}`);
});

test('un perfil real invalido no crea el tema con basura: cae a default', async () => {
  const conv = await crearConversacion('Raro', 'vps-default', '; drop table');
  assert.equal(conv.perfil_hermes, 'default');
});

test('claveSesionTema respeta la clave guardada y la recalcula en filas viejas', async () => {
  const conv = await crearConversacion('Con clave', 'vps-default', 'nerio');
  assert.equal(claveSesionTema(conv), `os:nerio:${conv.id.slice(0, 8)}`);
  // Conversacion anterior a la migracion: session_key nula.
  const vieja = { ...conv, session_key: null };
  assert.equal(claveSesionTema(vieja), `os:nerio:${conv.id.slice(0, 8)}`);
});

test('el turno le habla al perfil real del tema, no al default', async () => {
  const vistos: Array<string | undefined> = [];
  const creadas: Array<string | undefined> = [];
  setStreamHermesChat(async (_m, _s, opts) => {
    vistos.push(opts.perfilHermes);
    return 'listo';
  });
  setCrearSesionHermesChat(async (_id, _titulo, _perfil, _key, opts) => {
    creadas.push(opts?.perfilHermes);
  });

  const conv = await crearConversacion('Contratos', 'vps-default', 'rafik');
  await leerEventos(await enviarMensajeStream(conv.id, 'revisa esto'));

  assert.deepEqual(vistos, ['rafik']);
  assert.deepEqual(creadas, ['rafik']);
  const runFinal = estado.runs[0] as unknown as Run;
  assert.equal((runFinal.evidencia as Record<string, unknown>).perfil_hermes, 'rafik');
});

test('renombrar avisa al perfil real dueno de la sesion', async () => {
  const vistos: Array<string | undefined> = [];
  setRenombrarSesionHermesChat(async (_id, _titulo, _perfil, opts) => {
    vistos.push(opts?.perfilHermes);
    return true;
  });
  const conv = await crearConversacion('Tema', 'vps-default', 'taskr');
  await renombrarConversacion(conv.id, 'Tema nuevo');
  assert.deepEqual(vistos, ['taskr']);
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

test('renombrar una conversacion la deja con el nombre puesto a mano', async () => {
  const conv = await crearConversacion();
  const renombrada = await renombrarConversacion(conv.id, '  Legal IESS  ');
  assert.equal(renombrada.titulo, 'Legal IESS');
  // El titulo automatico solo pisa 'Nueva conversacion', asi que el nombre
  // puesto a mano sobrevive al primer mensaje.
  await enviarMensaje(conv.id, 'hola');
  assert.equal(estado.conversaciones[0].titulo, 'Legal IESS');
});

test('renombrar replica el nombre a la sesion de Hermes', async () => {
  const vistos: Array<[string, string]> = [];
  setRenombrarSesionHermesChat(async (sessionId, titulo) => {
    vistos.push([sessionId, titulo]);
    return true;
  });
  const conv = await crearConversacion();
  await renombrarConversacion(conv.id, 'Compras enero');
  assert.deepEqual(vistos, [[String(conv.hermes_session_id), 'Compras enero']]);
});

test('renombrar no revienta si Hermes rechaza el PATCH', async () => {
  setRenombrarSesionHermesChat(async () => {
    throw new Error('405 Method Not Allowed');
  });
  const conv = await crearConversacion();
  const renombrada = await renombrarConversacion(conv.id, 'Sigue funcionando');
  assert.equal(renombrada.titulo, 'Sigue funcionando');
});

test('validaciones de renombrado', async () => {
  const conv = await crearConversacion();
  await assert.rejects(() => renombrarConversacion(conv.id, '   '), /requerido/);
  await assert.rejects(() => renombrarConversacion(conv.id, 'x'.repeat(200)), /demasiado largo/);
  await assert.rejects(() => renombrarConversacion(randomUUID(), 'x'), /no encontrada/);
});

// --- Streaming (F1) ---------------------------------------------------------
//
// El seam setStreamHermesChat reemplaza a streamTaski: el doble decide que
// eventos emite y que texto final devuelve, asi que aca se prueba lo que de
// verdad importa del camino con streaming (que el cliente vea los deltas y que
// la persistencia NO dependa de que el cliente siga escuchando).

interface EventoLeido {
  tipo: string;
  texto?: string;
  herramienta?: string;
  datos?: Record<string, unknown>;
}

async function leerEventos(stream: ReadableStream<Uint8Array>): Promise<EventoLeido[]> {
  const eventos: EventoLeido[] = [];
  await leerSse(stream, (trama) => eventos.push(JSON.parse(trama.datos) as EventoLeido));
  return eventos;
}

test('enviarMensajeStream emite los deltas y persiste el mensaje final', async () => {
  const llamadas: Array<{ sessionId: string; sessionKey?: string }> = [];
  setStreamHermesChat(async (_mensaje, sessionId, opts, onEvento) => {
    llamadas.push({ sessionId, sessionKey: opts.sessionKey });
    onEvento({ tipo: 'message.started' });
    onEvento({ tipo: 'assistant.delta', texto: 'Reviso ' });
    onEvento({ tipo: 'tool.started', herramienta: 'terminal' });
    onEvento({ tipo: 'assistant.delta', texto: 'la agenda ' });
    onEvento({ tipo: 'assistant.delta', texto: 'de hoy.' });
    // El run.completed de Hermes se filtra: el server emite el suyo despues de
    // guardar, para que el cliente no recargue el hilo antes de tiempo.
    onEvento({ tipo: 'run.completed' });
    return 'Reviso la agenda de hoy.';
  });

  const conv = (await crearConversacion('Agenda')) as Conversacion;
  const eventos = await leerEventos(await enviarMensajeStream(conv.id, 'que tengo hoy'));

  assert.deepEqual(eventos.map((e) => e.tipo), [
    'run.started',
    'message.started',
    'assistant.delta',
    'tool.started',
    'assistant.delta',
    'assistant.delta',
    'run.completed',
  ]);
  assert.equal(
    eventos.filter((e) => e.tipo === 'assistant.delta').map((e) => e.texto).join(''),
    'Reviso la agenda de hoy.',
  );
  assert.equal(eventos[3].herramienta, 'terminal');
  // El primer frame trae el run recien creado, para poder caer al polling.
  assert.equal(typeof (eventos[0].datos?.run as Run | undefined)?.id, 'string');
  assert.equal(eventos[6].datos?.estado, 'completado');

  // Persistencia: el hilo real es el del OS, no el stream.
  const hilo = await obtenerHilo(conv.id);
  assert.equal(hilo.runActivo, null);
  assert.deepEqual(hilo.mensajes.map((m) => m.rol), ['user', 'assistant']);
  assert.equal(hilo.mensajes[1].contenido, 'Reviso la agenda de hoy.');
  const runFinal = estado.runs[0] as unknown as Run;
  assert.equal(runFinal.estado, 'completado');
  assert.equal((runFinal.evidencia as Record<string, unknown>).streaming, true);

  // Session key del tema: no depende del titulo, asi renombrar no borra memoria.
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].sessionId, conv.hermes_session_id);
  assert.equal(llamadas[0].sessionKey, `os:default:${conv.id.slice(0, 8)}`);
  assert.equal(claveSesionTema(conv), llamadas[0].sessionKey);
});

test('si el cliente cancela el stream, el turno sigue y la respuesta se guarda', async () => {
  const control: { seguir?: () => void } = {};
  setStreamHermesChat(async (_mensaje, _sessionId, _opts, onEvento) => {
    onEvento({ tipo: 'assistant.delta', texto: 'voy a mitad' });
    await new Promise<void>((resolver) => {
      control.seguir = resolver;
    });
    return 'respuesta completa';
  });

  const conv = await crearConversacion();
  const stream = await enviarMensajeStream(conv.id, 'hola');
  const lector = stream.getReader();
  await lector.read();
  await lector.cancel(); // el navegador se fue

  control.seguir?.();
  await new Promise((r) => setTimeout(r, 20));

  const hilo = await obtenerHilo(conv.id);
  assert.deepEqual(hilo.mensajes.map((m) => m.rol), ['user', 'assistant']);
  assert.equal(hilo.mensajes[1].contenido, 'respuesta completa');
  assert.equal((estado.runs[0] as unknown as Run).estado, 'completado');
});

test('si el stream falla, el run queda fallido y el cliente recibe el error', async () => {
  setStreamHermesChat(async () => {
    throw new Error('Hermes HTTP 502');
  });
  const conv = await crearConversacion();
  const eventos = await leerEventos(await enviarMensajeStream(conv.id, 'hola'));

  assert.deepEqual(eventos.map((e) => e.tipo), ['run.started', 'error', 'run.completed']);
  assert.equal(eventos[2].datos?.estado, 'fallido');
  const runFinal = estado.runs[0] as unknown as Run;
  assert.equal(runFinal.estado, 'fallido');
  assert.match(String(runFinal.error), /502/);
  assert.equal(estado.mensajes.filter((m) => m.rol === 'assistant').length, 0);
});

test('el stream respeta el candado de un run por conversacion', async () => {
  setEnviarAHermesChat(() => new Promise((r) => setTimeout(() => r('tarde'), 200)));
  const conv = await crearConversacion();
  await enviarMensaje(conv.id, 'primero');
  await assert.rejects(enviarMensajeStream(conv.id, 'segundo'), /sigue trabajando/);
});


// ---------------------------------------------------------------------------
// F3: vinculacion con topics de Telegram
// ---------------------------------------------------------------------------

test('vincularTopic solo guarda la referencia al topic, sin tocar la session_key', async () => {
  const conv = await crearConversacion('Legal', 'vps-default');
  const vinculada = await vincularTopic(conv.id, '-1004384794270', 51);

  assert.equal(vinculada.topic_telegram, '-1004384794270:51');
  // El vinculo es una referencia de agrupacion, no un puente de memoria: la
  // clave del tema sigue siendo la propia (ver claveSesionTema).
  assert.equal(vinculada.session_key, `os:default:${conv.id.slice(0, 8)}`);
  assert.equal(claveSesionTema(vinculada), `os:default:${conv.id.slice(0, 8)}`);
});

test('vincularTopic tampoco toca la clave con un perfil que no es default', async () => {
  const conv = await crearConversacion('Legal', 'vps-default', 'rafik');
  const vinculada = await vincularTopic(conv.id, '-1004384794270', 77);
  assert.equal(vinculada.topic_telegram, '-1004384794270:77');
  assert.equal(vinculada.session_key, `os:rafik:${conv.id.slice(0, 8)}`);
});

test('desvincularTopic limpia el topic y conserva la clave propia', async () => {
  const conv = await crearConversacion('Legal', 'vps-default', 'nerio');
  await vincularTopic(conv.id, '-1004384794270', 12);
  const suelta = await desvincularTopic(conv.id);

  assert.equal(suelta.topic_telegram, null);
  assert.equal(suelta.session_key, `os:nerio:${conv.id.slice(0, 8)}`);
  assert.equal(claveSesionTema(suelta), suelta.session_key);
});

test('desvincularTopic sanea la clave de Telegram que dejaron las filas viejas', async () => {
  const conv = await crearConversacion('Legal', 'vps-default', 'nerio');
  // Fila escrita por la version anterior de F3, que reescribia la session_key.
  estado.conversaciones[0].session_key = 'agent:nerio:telegram:forum:-1004384794270:12';
  estado.conversaciones[0].topic_telegram = '-1004384794270:12';
  const suelta = await desvincularTopic(conv.id);
  assert.equal(suelta.session_key, `os:nerio:${conv.id.slice(0, 8)}`);
});

test('dos temas del mismo agente no pueden tomar el mismo topic', async () => {
  const a = await crearConversacion('A', 'vps-default');
  const b = await crearConversacion('B', 'vps-default');
  await vincularTopic(a.id, '-1004384794270', 51);
  await assert.rejects(vincularTopic(b.id, '-1004384794270', 51), /ya esta vinculado/);
});

test('vincularTopic rechaza coordenadas invalidas', async () => {
  const conv = await crearConversacion('X', 'vps-default');
  await assert.rejects(vincularTopic(conv.id, 'abc', 51), /invalido/);
  await assert.rejects(vincularTopic(conv.id, '-1004384794270', 0), /invalido/);
  await assert.rejects(vincularTopic(conv.id, '-1004384794270', -3), /invalido/);
});

test('parsearTopicTelegram acepta solo el formato <chat_id>:<thread_id>', () => {
  assert.deepEqual(parsearTopicTelegram('-1004384794270:51'), { chatId: '-1004384794270', threadId: 51 });
  assert.deepEqual(parsearTopicTelegram('123:4'), { chatId: '123', threadId: 4 });
  for (const malo of ['', '51', ':51', '123:', 'abc:1', '123:0', '123:-1', '123:1:2', '0123:1', ' 123:1 x']) {
    assert.equal(parsearTopicTelegram(malo), null, `deberia rechazar: ${malo}`);
  }
});
