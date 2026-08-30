// Pruebas del bridge de escritorio (src/lib/desktopBridge.ts).
//
// Corren en Node puro, SIN Tauri: verifican el contrato del camino navegador,
// que es el que protege al web OS de regresiones. Todas las funciones deben
// resolver (nunca lanzar) con el error tipado 'sin_escritorio' o su valor
// neutro, y no deben intentar importar @tauri-apps/api (que aca no existe:
// si lo intentaran, el import dinamico reventaria y el test fallaria).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isDesktop,
  ollamaStatus,
  fsReadFile,
  fsWriteFile,
  terminalRequest,
  terminalListPending,
  terminalApprove,
  flowHealth,
  flowListDictations,
  flowListMeetings,
  flowRecordingStatus,
  flowStartRecording,
  flowStopRecording,
  flowPuedeSeguirEnCurso,
  flowErrorTexto,
  hermesAgentCard,
  hermesA2ACall,
  hermesFaltaConfigurar,
  hermesPuedeSeguirEnCurso,
  hermesErrorTexto,
} from './desktopBridge.ts';

test('isDesktop es false fuera de Tauri', () => {
  assert.equal(isDesktop(), false);
});

test('ollamaStatus devuelve estado neutro fuera de Tauri', async () => {
  assert.deepEqual(await ollamaStatus(), { available: false, version: null, models: [] });
});

test('fs devuelve sin_escritorio y nunca lanza', async () => {
  for (const r of [await fsReadFile('notas.txt'), await fsWriteFile('notas.txt', 'x')]) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.codigo, 'sin_escritorio');
  }
});

test('terminal devuelve sin_escritorio y nunca lanza', async () => {
  const resultados = [
    await terminalRequest('echo', ['hola']),
    await terminalListPending(),
    await terminalApprove('id-falso'),
  ];
  for (const r of resultados) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.codigo, 'sin_escritorio');
  }
});

test('flow devuelve sin_escritorio en todas sus llamadas', async () => {
  const resultados = [
    await flowHealth(),
    await flowListDictations(5),
    await flowListMeetings(),
    await flowRecordingStatus(),
    await flowStartRecording(),
    await flowStopRecording(123),
  ];
  for (const r of resultados) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.codigo, 'sin_escritorio');
  }
});

test('hermes devuelve sin_escritorio en card y llamada A2A', async () => {
  for (const r of [await hermesAgentCard(), await hermesA2ACall('hola')]) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.codigo, 'sin_escritorio');
  }
});

test('clasificadores de error de Flow', () => {
  assert.equal(flowPuedeSeguirEnCurso({ codigo: 'flow_timeout', mensaje: '' }), true);
  assert.equal(flowPuedeSeguirEnCurso({ codigo: 'flow_no_corriendo', mensaje: '' }), false);
  assert.equal(flowErrorTexto({ codigo: 'flow_no_corriendo', mensaje: '' }), 'Flow no esta corriendo.');
  assert.equal(
    flowErrorTexto({ codigo: 'flow_http', status: 409, mensaje: 'crudo' }),
    'Esa reunion ya no es la grabacion activa en Flow.',
  );
  assert.equal(flowErrorTexto({ codigo: 'flow_http', status: 500, mensaje: 'crudo' }), 'crudo');
});

test('clasificadores de error de Hermes', () => {
  assert.equal(hermesFaltaConfigurar({ codigo: 'hermes_sin_token', mensaje: '' }), true);
  assert.equal(hermesFaltaConfigurar({ codigo: 'hermes_config_invalida', mensaje: '' }), true);
  assert.equal(hermesFaltaConfigurar({ codigo: 'hermes_timeout', mensaje: '' }), false);
  assert.equal(hermesPuedeSeguirEnCurso({ codigo: 'hermes_timeout', mensaje: '' }), true);
  assert.equal(hermesPuedeSeguirEnCurso({ codigo: 'hermes_rpc', mensaje: '' }), false);
  const textoConPasos = 'Falta el token. Crea C:\\ruta\\config.json con...';
  assert.equal(hermesErrorTexto({ codigo: 'hermes_sin_token', mensaje: textoConPasos }), textoConPasos);
});
