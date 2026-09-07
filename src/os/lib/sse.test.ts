// Pruebas del parser SSE compartido (src/os/lib/sse.ts).
//
// Es el punto mas fragil del streaming del chat: los chunks de la red no
// respetan los limites de los eventos, asi que un bloque puede llegar partido
// en dos lecturas, o dos bloques pueden llegar juntos. Todo eso se prueba aca
// sin red, armando el ReadableStream a mano.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatearSse, leerSse, parsearBloqueSse, type TramaSse } from './sse.ts';

function streamDe(...trozos: string[]): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controlador) {
      for (const t of trozos) controlador.enqueue(codificador.encode(t));
      controlador.close();
    },
  });
}

async function tramas(...trozos: string[]): Promise<TramaSse[]> {
  const salida: TramaSse[] = [];
  await leerSse(streamDe(...trozos), (t) => salida.push(t));
  return salida;
}

test('parsearBloqueSse separa evento y datos', () => {
  assert.deepEqual(parsearBloqueSse('event: assistant.delta\ndata: hola'), {
    evento: 'assistant.delta',
    datos: 'hola',
  });
});

test('parsearBloqueSse une varias lineas data en una sola', () => {
  assert.deepEqual(parsearBloqueSse('event: x\ndata: {"a":1,\ndata: "b":2}'), {
    evento: 'x',
    datos: '{"a":1,\n"b":2}',
  });
});

test('parsearBloqueSse ignora comentarios y bloques vacios', () => {
  assert.equal(parsearBloqueSse(': keepalive'), null);
  assert.equal(parsearBloqueSse(''), null);
  // Sin `event:` la spec dice que el tipo es 'message'.
  assert.deepEqual(parsearBloqueSse('data: suelto'), { evento: 'message', datos: 'suelto' });
});

test('leerSse corta por linea en blanco y respeta el orden', async () => {
  const vistas = await tramas(
    'event: run.started\ndata: {}\n\n',
    'event: assistant.delta\ndata: uno\n\nevent: assistant.delta\ndata: dos\n\n',
  );
  assert.deepEqual(vistas.map((t) => t.evento), ['run.started', 'assistant.delta', 'assistant.delta']);
  assert.deepEqual(vistas.slice(1).map((t) => t.datos), ['uno', 'dos']);
});

test('leerSse arma un evento partido entre dos chunks', async () => {
  const vistas = await tramas('event: assis', 'tant.delta\ndata: par', 'tido\n\n');
  assert.deepEqual(vistas, [{ evento: 'assistant.delta', datos: 'partido' }]);
});

test('leerSse tolera CRLF y keepalives', async () => {
  const vistas = await tramas(': ping\r\n\r\n', 'event: tool.started\r\ndata: terminal\r\n\r\n');
  assert.deepEqual(vistas, [{ evento: 'tool.started', datos: 'terminal' }]);
});

test('leerSse entrega el ultimo bloque aunque el server corte sin linea en blanco', async () => {
  const vistas = await tramas('event: run.completed\ndata: {"ok":true}');
  assert.deepEqual(vistas, [{ evento: 'run.completed', datos: '{"ok":true}' }]);
});

test('formatearSse arma una trama que el propio parser vuelve a leer', async () => {
  const trama = formatearSse('assistant.delta', { tipo: 'assistant.delta', texto: 'linea1\nlinea2' });
  const [leida] = await tramas(trama);
  assert.equal(leida.evento, 'assistant.delta');
  assert.deepEqual(JSON.parse(leida.datos), { tipo: 'assistant.delta', texto: 'linea1\nlinea2' });
});
