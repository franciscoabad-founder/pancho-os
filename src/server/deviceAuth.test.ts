// Contrato de la cripto del pairing. Lo que se protege aca es el invariante
// del modelo de seguridad: el token crudo se entrega UNA vez y lo unico
// persistible es su hash.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BYTES_TOKEN,
  PAIRING_TTL_MS,
  PAIRING_MAX_POR_CLIENTE,
  PAIRING_VENTANA_MS,
  esCodigoValido,
  esKindValido,
  esUuid,
  estaVencido,
  expiracionPairing,
  generarCodigoPairing,
  generarTokenDispositivo,
  guardarTokenEnCustodia,
  hashTokenDispositivo,
  normalizarCodigo,
  permitirPairing,
  reclamarTokenEnCustodia,
  vaciarCustodia,
  vaciarLimitePairing,
} from './deviceAuth.ts';

// --- tokens ------------------------------------------------------------------

test('generarTokenDispositivo devuelve 32 bytes en base64url', () => {
  const token = generarTokenDispositivo();
  // base64url de 32 bytes sin padding: 43 caracteres, sin +, / ni =.
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(token, 'base64url').length, BYTES_TOKEN);
});

test('dos tokens seguidos nunca coinciden', () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 500; i++) vistos.add(generarTokenDispositivo());
  assert.equal(vistos.size, 500);
});

test('hashTokenDispositivo es sha256 hex, estable y distinto por token', () => {
  const hash = hashTokenDispositivo('token-de-prueba');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashTokenDispositivo('token-de-prueba'));
  assert.notEqual(hash, hashTokenDispositivo('token-de-prueba2'));
});

test('el hash no contiene el token', () => {
  const token = generarTokenDispositivo();
  assert.equal(hashTokenDispositivo(token).includes(token), false);
});

// --- codigos -----------------------------------------------------------------

test('generarCodigoPairing siempre da 6 digitos, ceros a la izquierda incluidos', () => {
  for (let i = 0; i < 2000; i++) {
    const code = generarCodigoPairing();
    assert.equal(code.length, 6);
    assert.match(code, /^[0-9]{6}$/);
  }
});

test('esCodigoValido acepta solo 6 digitos', () => {
  assert.equal(esCodigoValido('000000'), true);
  assert.equal(esCodigoValido('482913'), true);
  assert.equal(esCodigoValido('48291'), false);
  assert.equal(esCodigoValido('4829134'), false);
  assert.equal(esCodigoValido('48291a'), false);
  assert.equal(esCodigoValido(482913), false);
  assert.equal(esCodigoValido(null), false);
});

test('normalizarCodigo limpia lo que tipea el usuario', () => {
  assert.equal(normalizarCodigo('482 913'), '482913');
  assert.equal(normalizarCodigo('482-913'), '482913');
  assert.equal(normalizarCodigo('  482913  '), '482913');
  assert.equal(normalizarCodigo('4829134567'), '482913');
});

// --- kinds -------------------------------------------------------------------

test('esKindValido es una lista cerrada', () => {
  for (const k of ['desktop', 'android', 'agent', 'browser']) assert.equal(esKindValido(k), true);
  assert.equal(esKindValido('tablet'), false);
  assert.equal(esKindValido('Desktop'), false);
  assert.equal(esKindValido(undefined), false);
});

// --- expiracion --------------------------------------------------------------

test('expiracionPairing suma 10 minutos', () => {
  const base = new Date('2026-08-23T10:00:00.000Z');
  assert.equal(expiracionPairing(base).toISOString(), '2026-08-23T10:10:00.000Z');
  assert.equal(PAIRING_TTL_MS, 600_000);
});

test('estaVencido compara contra el ahora dado y falla cerrado con basura', () => {
  const ahora = new Date('2026-08-23T10:05:00.000Z');
  assert.equal(estaVencido('2026-08-23T10:10:00.000Z', ahora), false);
  assert.equal(estaVencido('2026-08-23T10:00:00.000Z', ahora), true);
  // Empatar con el instante exacto cuenta como vencido.
  assert.equal(estaVencido('2026-08-23T10:05:00.000Z', ahora), true);
  assert.equal(estaVencido('no-es-una-fecha', ahora), true);
});

// --- custodia del token crudo ------------------------------------------------

test('el token en custodia se reclama una sola vez', () => {
  vaciarCustodia();
  guardarTokenEnCustodia('pairing-1', 'tok-crudo');
  assert.equal(reclamarTokenEnCustodia('pairing-1'), 'tok-crudo');
  assert.equal(reclamarTokenEnCustodia('pairing-1'), undefined);
});

test('reclamar una custodia inexistente devuelve undefined, no lanza', () => {
  vaciarCustodia();
  assert.equal(reclamarTokenEnCustodia('no-existe'), undefined);
});

test('cada pairing tiene su propia custodia', () => {
  vaciarCustodia();
  guardarTokenEnCustodia('a', 'tok-a');
  guardarTokenEnCustodia('b', 'tok-b');
  assert.equal(reclamarTokenEnCustodia('b'), 'tok-b');
  assert.equal(reclamarTokenEnCustodia('a'), 'tok-a');
});

// --- esUuid ------------------------------------------------------------------

test('esUuid acepta uuids y rechaza cualquier otra cosa', () => {
  assert.equal(esUuid('0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'), true);
  assert.equal(esUuid('0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0'), true, 'el hex en mayusculas vale');
  for (const malo of [
    '',
    'fake-1',
    '0f1e2d3c4b5a69788796a5b4c3d2e1f0', // sin guiones
    '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f', // un caracter menos
    '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0x',
    'zzzzzzzz-4b5a-6978-8796-a5b4c3d2e1f0',
    null,
    undefined,
    123,
  ]) {
    assert.equal(esUuid(malo), false, `deberia rechazar ${String(malo)}`);
  }
});

// --- limite de frecuencia de pair/start --------------------------------------
//
// pair/start es el unico endpoint del OS que escribe sin autenticar. Estos
// casos son el freno: sin ellos, cualquiera desde internet infla
// os_pairing_requests y puede dejar sin codigos libres al pairing legitimo.

test('permitirPairing deja pasar el cupo del cliente y despues corta', () => {
  vaciarLimitePairing();
  const ahora = Date.now();
  for (let i = 0; i < PAIRING_MAX_POR_CLIENTE; i++) {
    assert.equal(permitirPairing('1.2.3.4', ahora), true, `intento ${i + 1} deberia pasar`);
  }
  assert.equal(permitirPairing('1.2.3.4', ahora), false, 'el que pasa el cupo se corta');
});

test('el cupo es por cliente, no global', () => {
  vaciarLimitePairing();
  const ahora = Date.now();
  for (let i = 0; i < PAIRING_MAX_POR_CLIENTE; i++) permitirPairing('1.2.3.4', ahora);
  assert.equal(permitirPairing('1.2.3.4', ahora), false);
  assert.equal(permitirPairing('5.6.7.8', ahora), true, 'otra IP tiene su propio cupo');
});

test('la ventana es deslizante: al vencer se recupera el cupo', () => {
  vaciarLimitePairing();
  const t0 = Date.now();
  for (let i = 0; i < PAIRING_MAX_POR_CLIENTE; i++) permitirPairing('1.2.3.4', t0);
  assert.equal(permitirPairing('1.2.3.4', t0), false);

  // Justo antes de que venza la ventana sigue cortado...
  assert.equal(permitirPairing('1.2.3.4', t0 + PAIRING_VENTANA_MS - 1000), false);
  // ...y pasada la ventana entera, vuelve a pasar.
  assert.equal(permitirPairing('1.2.3.4', t0 + PAIRING_VENTANA_MS + 1), true);
});

test('un cliente que rota identidades no hace crecer la tabla sin limite', () => {
  vaciarLimitePairing();
  const t0 = Date.now();
  // Muchas claves distintas dentro de la ventana: el limitador desaloja las mas
  // viejas en vez de acumular. Lo que NO puede pasar es que empiece a rechazar
  // a un cliente nuevo por presion de memoria, porque eso seria justamente la
  // forma de bloquear el pairing legitimo que se busca evitar.
  for (let i = 0; i < 6000; i++) {
    assert.equal(permitirPairing(`ip-${i}`, t0), true, `la clave nueva ${i} deberia pasar`);
  }
});
