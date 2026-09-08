// Pruebas del buzon de eventos de Hermes (F4) con Supabase fake en memoria,
// mismo patron que chat.handlers.test.ts. Se prueban las dos cosas que hacen
// util a F4: que el evento SIEMPRE quede guardado (aunque no matchee nada) y
// que cuando si matchea un tema le pegue el evento e inserte el mensaje
// proactivo, salvo que haya un run en vuelo.
//
// La autenticacion del webhook (x-hermes-secret) se prueba aparte, contra la
// funcion de la ruta, porque es una regla de transporte y no del handler.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  listarEventos,
  marcarLeido,
  registrarEvento,
  setClienteSupabaseEventos,
  type EventoHermesFila,
} from './hermesEventos.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado {
  eventos: Fila[];
  conversaciones: Fila[];
  mensajes: Fila[];
  runs: Fila[];
}

function crearClienteFake(estado: Estado): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === 'hermes_eventos') return estado.eventos;
    if (nombre === 'chat_conversaciones') return estado.conversaciones;
    if (nombre === 'chat_mensajes') return estado.mensajes;
    if (nombre === 'chat_runs') return estado.runs;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function defaults(nombre: string): Fila {
    const ahora = new Date().toISOString();
    if (nombre === 'hermes_eventos') {
      return {
        id: randomUUID(), perfil_hermes: null, session_id: null, session_key: null,
        titulo: null, payload: {}, leido: false, created_at: ahora,
      };
    }
    return { id: randomUUID(), created_at: ahora };
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

/** Tema del OS ya creado, como lo dejaria crearConversacion. */
function sembrarTema(sessionKey: string, sessionId = 'os-chat-abc12345'): Fila {
  const fila: Fila = {
    id: randomUUID(), titulo: 'Tema', perfil: 'vps-default', perfil_hermes: 'default',
    session_key: sessionKey, hermes_session_id: sessionId, topic_telegram: null,
    estado: 'activo', ultimo_evento: {}, archivada: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  estado.conversaciones.push(fila);
  return fila;
}

beforeEach(() => {
  estado = { eventos: [], conversaciones: [], mensajes: [], runs: [] };
  setClienteSupabaseEventos(() => crearClienteFake(estado));
});

test('registrarEvento guarda el cuerpo completo en payload', async () => {
  const { evento, conversacion_id } = await registrarEvento({
    tipo: 'job.completed',
    titulo: 'Reporte listo',
    extra: { minutos: 12 },
  });

  assert.equal(evento.tipo, 'job.completed');
  assert.equal(evento.titulo, 'Reporte listo');
  assert.equal(evento.leido, false);
  // Nada se pierde: los campos que el OS todavia no modela viven en payload.
  assert.deepEqual((evento.payload as Record<string, unknown>).extra, { minutos: 12 });
  // Sin session_key ni session_id, el evento queda suelto y eso no es un error.
  assert.equal(conversacion_id, null);
  assert.equal(estado.eventos.length, 1);
});

test('un evento sin tipo se rechaza', async () => {
  await assert.rejects(registrarEvento({ titulo: 'sin tipo' }), /tipo es requerido/);
  await assert.rejects(registrarEvento('no soy un objeto'), /Cuerpo invalido/);
  assert.equal(estado.eventos.length, 0);
});

test('un evento con session_key de un tema le actualiza el ultimo_evento e inserta el mensaje proactivo', async () => {
  const tema = sembrarTema('os:default:abc12345');
  const res = await registrarEvento({
    tipo: 'agent.message',
    titulo: 'Termine el reporte',
    session_key: 'os:default:abc12345',
    content: 'Ya deje el reporte de la semana en el brain.',
  });

  assert.equal(res.conversacion_id, tema.id);
  assert.equal(res.mensaje_insertado, true);

  const ultimo = estado.conversaciones[0].ultimo_evento as Record<string, unknown>;
  assert.equal(ultimo.tipo, 'agent.message');
  assert.equal(ultimo.titulo, 'Termine el reporte');
  assert.equal(ultimo.id, res.evento.id);

  assert.equal(estado.mensajes.length, 1);
  assert.equal(estado.mensajes[0].rol, 'assistant');
  assert.equal(estado.mensajes[0].contenido, 'Ya deje el reporte de la semana en el brain.');
  assert.equal(estado.mensajes[0].conversacion_id, tema.id);
});

test('un evento con la session_key de un topic de Telegram tambien encuentra su tema (F3)', async () => {
  const tema = sembrarTema('agent:main:telegram:forum:-1004384794270:51');
  const res = await registrarEvento({
    tipo: 'agent.message',
    session_key: 'agent:main:telegram:forum:-1004384794270:51',
    content: 'Contestado desde el topic.',
  });
  assert.equal(res.conversacion_id, tema.id);
  assert.equal(res.mensaje_insertado, true);
});

test('sin session_key se cae al session_id de la sesion de Hermes', async () => {
  const tema = sembrarTema('os:default:abc12345', 'os-chat-abc12345');
  const res = await registrarEvento({ tipo: 'run.completed', session_id: 'os-chat-abc12345' });
  assert.equal(res.conversacion_id, tema.id);
  // Sin `content` no hay mensaje proactivo: solo se marca el tema.
  assert.equal(res.mensaje_insertado, false);
  assert.equal(estado.mensajes.length, 0);
});

test('un evento que no matchea ningun tema queda suelto sin romper nada', async () => {
  sembrarTema('os:default:abc12345');
  const res = await registrarEvento({
    tipo: 'agent.message',
    session_key: 'os:rafik:99999999',
    content: 'esto no es de ningun tema conocido',
  });

  assert.equal(res.conversacion_id, null);
  assert.equal(res.mensaje_insertado, false);
  assert.equal(estado.eventos.length, 1);
  assert.equal(estado.mensajes.length, 0);
  // El tema ajeno no se toca.
  assert.deepEqual(estado.conversaciones[0].ultimo_evento, {});
});

test('con un run en vuelo no se inserta el mensaje proactivo (evitaria duplicar la respuesta)', async () => {
  const tema = sembrarTema('os:default:abc12345');
  estado.runs.push({ id: randomUUID(), conversacion_id: tema.id, estado: 'trabajando' });

  const res = await registrarEvento({
    tipo: 'agent.message',
    session_key: 'os:default:abc12345',
    content: 'respuesta que ya viene por el stream',
  });

  assert.equal(res.conversacion_id, tema.id);
  assert.equal(res.mensaje_insertado, false);
  assert.equal(estado.mensajes.length, 0);
  // El evento igual quedo registrado y el tema marcado.
  assert.equal(estado.eventos.length, 1);
  assert.equal((estado.conversaciones[0].ultimo_evento as Record<string, unknown>).tipo, 'agent.message');
});

test('listarEventos filtra por leido y marcarLeido saca el evento de la campana', async () => {
  await registrarEvento({ tipo: 'uno' });
  const { evento } = await registrarEvento({ tipo: 'dos' });

  assert.equal((await listarEventos({ leido: false })).length, 2);
  assert.equal((await listarEventos()).length, 2);

  const marcado = await marcarLeido(evento.id);
  assert.equal(marcado.leido, true);

  const pendientes = await listarEventos({ leido: false });
  assert.deepEqual(pendientes.map((e: EventoHermesFila) => e.tipo), ['uno']);
  assert.equal((await listarEventos({ leido: true })).length, 1);
});

test('marcarLeido valida el id', async () => {
  await assert.rejects(marcarLeido(''), /id es requerido/);
  await assert.rejects(marcarLeido(randomUUID()), /no encontrado/);
});
