// Pruebas de la logica pura de taski.handlers.ts y del rotulado compartido de
// sesiones (src/os/lib/sesiones.ts). Sin red: aca solo se prueban las funciones
// que traducen lo que devuelve Hermes a lo que necesita la UI.
//
// Cubre los tres errores que motivaron el fix del 6 sep 2026:
//   - el catalogo de modelos venia de /v1/models y solo traia "hermes-agent"
//   - last_active llegaba en segundos y se pintaba como 1970
//   - las sesiones os-chat-* nunca aparecian porque se filtraba source=telegram

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aMilisegundos,
  aplanarOpcionesModelo,
  clasificarOrigen,
  partirModelo,
  validarOrigen,
} from './taski.handlers.ts';
import { etiquetaSesion, fechaSesion, nombreSesion } from '../os/lib/sesiones.ts';

test('aplanarOpcionesModelo arma la lista real de proveedor/modelo', () => {
  const modelos = aplanarOpcionesModelo({
    providers: [
      { slug: 'deepseek', name: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-r2'] },
      { slug: 'openai', name: 'OpenAI', models: ['gpt-4o'] },
    ],
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  });

  assert.deepEqual(
    modelos.map((m) => m.id),
    ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-r2', 'openai/gpt-4o'],
  );
  // El que el gateway reporta como configurado queda marcado.
  assert.equal(modelos[0].isCurrent, true);
  assert.equal(modelos[1].isCurrent, false);
  assert.equal(modelos[2].provider, 'openai');
  assert.equal(modelos[2].modelId, 'gpt-4o');
});

test('aplanarOpcionesModelo descarta el modelo virtual y los duplicados', () => {
  const modelos = aplanarOpcionesModelo({
    providers: [
      { slug: 'x', name: 'X', models: ['hermes-agent', 'uno', 'uno'] },
      { slug: 'x', name: 'X', models: ['uno'] },
    ],
  });
  // "hermes-agent" no es un modelo real: es el alias que /v1/models anuncia
  // para "usa el default del gateway", y Hermes mismo lo anula si se lo mandan.
  assert.deepEqual(modelos.map((m) => m.id), ['x/uno']);
});

test('aplanarOpcionesModelo avisa cuando el proveedor no esta autenticado', () => {
  const [modelo] = aplanarOpcionesModelo({
    providers: [{ slug: 'anthropic', name: 'Anthropic', models: ['claude'], authenticated: false, warning: 'Sin API key' }],
  });
  assert.equal(modelo.description, 'Sin API key');
});

test('aplanarOpcionesModelo tolera un payload vacio o mal formado', () => {
  assert.deepEqual(aplanarOpcionesModelo({}), []);
  assert.deepEqual(aplanarOpcionesModelo({ providers: 'nada' }), []);
  assert.deepEqual(aplanarOpcionesModelo({ providers: [{ name: 'sin slug', models: ['a'] }] }), []);
});

test('partirModelo separa proveedor y modelo por la primera barra', () => {
  assert.deepEqual(partirModelo('openai/gpt-4o'), { provider: 'openai', model: 'gpt-4o' });
  // Aggregadores: el modelo puede traer barras propias y hay que conservarlas.
  assert.deepEqual(partirModelo('openrouter/deepseek/deepseek-v4'), {
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4',
  });
  assert.deepEqual(partirModelo('gpt-4o'), { model: 'gpt-4o' });
});

test('aMilisegundos normaliza el epoch en segundos de Hermes', () => {
  // 6 sep 2026 en segundos.
  assert.equal(aMilisegundos(1788700000), 1788700000000);
  // Ya en milisegundos: se respeta.
  assert.equal(aMilisegundos(1788700000000), 1788700000000);
  assert.equal(aMilisegundos('1788700000'), 1788700000000);
  assert.equal(aMilisegundos(null), null);
  assert.equal(aMilisegundos(0), null);
  assert.equal(aMilisegundos('hola'), null);
});

test('clasificarOrigen separa Telegram, OS y ruido interno', () => {
  assert.equal(clasificarOrigen('telegram', 'agent:main:telegram:forum:-100:53'), 'telegram');
  assert.equal(clasificarOrigen('api_server', 'os-chat-ab12cd34'), 'os');
  assert.equal(clasificarOrigen('api_server', 'pancho-os'), 'os');
  // Una sesion del OS aunque el source venga raro.
  assert.equal(clasificarOrigen('desconocido', 'os-chat-ab12cd34'), 'os');
  // Ejecuciones internas de Hermes: no son conversaciones de Pancho.
  assert.equal(clasificarOrigen('cron', 'cron-1'), null);
  assert.equal(clasificarOrigen('a2a', 'a2a-1'), null);
  assert.equal(clasificarOrigen('cli', 'cli-1'), null);
});

test('validarOrigen cae a "todas" ante cualquier basura', () => {
  assert.equal(validarOrigen('telegram'), 'telegram');
  assert.equal(validarOrigen('os'), 'os');
  assert.equal(validarOrigen('todas'), 'todas');
  assert.equal(validarOrigen(undefined), 'todas');
  assert.equal(validarOrigen('; drop table'), 'todas');
});

test('etiquetaSesion muestra Nombre y dd/mm HH:mm, sin el conteo pegado', () => {
  const ms = new Date(2026, 8, 6, 14, 5).getTime(); // 06/09 14:05 local
  const etiqueta = etiquetaSesion({ id: 'x', title: 'Friendly greeting', messageCount: 83, lastActive: ms });
  assert.equal(etiqueta, 'Friendly greeting · 06/09 14:05');
  // El conteo NO va en el nombre: son mensajes acumulados, no sin leer.
  assert.ok(!etiqueta.includes('83'));
});

test('etiquetaSesion sin fecha no deja un separador huerfano', () => {
  assert.equal(etiquetaSesion({ id: 'x', title: 'Taski OS', lastActive: null }), 'Taski OS');
});

test('fechaSesion tolera epoch en segundos', () => {
  const ms = new Date(2026, 0, 2, 9, 7).getTime();
  assert.equal(fechaSesion(ms), '02/01 09:07');
  assert.equal(fechaSesion(Math.floor(ms / 1000)), '02/01 09:07');
  assert.equal(fechaSesion(null), '');
  assert.equal(fechaSesion(undefined), '');
});

test('nombreSesion inventa un rotulo util cuando Hermes no dio titulo', () => {
  assert.equal(nombreSesion({ id: 'pancho-os', title: null }), 'Taski (OS)');
  assert.equal(nombreSesion({ id: 'zzz', title: null, origen: 'telegram' }), 'Conversacion de Telegram');
  assert.equal(nombreSesion({ id: 'os-chat-ab12cd34', title: null }), 'Conversacion del OS');
  assert.equal(nombreSesion({ id: 'algo-muy-largo-de-verdad', title: '   ' }), 'algo-muy-lar');
});
