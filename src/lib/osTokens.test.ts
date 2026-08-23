// Contrato de los tokens de API del OS. Es la base de toda la superficie
// autenticada (MCP, Hermes, n8n, las keys con nombre de OS_API_TOKENS), asi
// que lo que mas importa aca es que falle CERRADO cuando no hay nada
// configurado: sin env vars, ningun candidato puede ser valido.

import assert from 'node:assert/strict';
import test from 'node:test';
import { esTokenValido, parseNamedTokens, parseNombresTokens } from './osTokens.ts';

test('parseNamedTokens devuelve lista vacia sin configuracion', () => {
  assert.deepEqual(parseNamedTokens(undefined), []);
  assert.deepEqual(parseNamedTokens(null), []);
  assert.deepEqual(parseNamedTokens(''), []);
});

test('parseNamedTokens extrae el secreto de cada entrada nombre:secreto', () => {
  assert.deepEqual(parseNamedTokens('kimi:abc123,grok:xyz789'), ['abc123', 'xyz789']);
});

test('parseNamedTokens tolera espacios y entradas vacias', () => {
  assert.deepEqual(parseNamedTokens(' kimi:abc123 , , grok:xyz789 ,'), ['abc123', 'xyz789']);
});

test('parseNamedTokens acepta entradas sin nombre como token pelado', () => {
  assert.deepEqual(parseNamedTokens('abc123,grok:xyz789'), ['abc123', 'xyz789']);
});

test('parseNamedTokens corta solo en el primer dos puntos', () => {
  // Un secreto puede contener ':' (por ejemplo un token con prefijo propio):
  // el nombre es lo que va ANTES del primer separador, el resto es el secreto.
  assert.deepEqual(parseNamedTokens('n8n:pref:resto'), ['pref:resto']);
});

test('esTokenValido falla cerrado sin maestro ni lista', () => {
  assert.equal(esTokenValido('lo-que-sea', undefined, undefined), false);
  assert.equal(esTokenValido('lo-que-sea', null, null), false);
  assert.equal(esTokenValido('lo-que-sea', '', ''), false);
});

test('esTokenValido rechaza candidato ausente aunque haya maestro', () => {
  assert.equal(esTokenValido(undefined, 'maestro', 'kimi:abc'), false);
  assert.equal(esTokenValido(null, 'maestro', 'kimi:abc'), false);
  assert.equal(esTokenValido('', 'maestro', 'kimi:abc'), false);
});

test('esTokenValido acepta el token maestro', () => {
  assert.equal(esTokenValido('maestro', 'maestro', undefined), true);
});

test('esTokenValido acepta una key con nombre de la lista', () => {
  assert.equal(esTokenValido('abc123', 'maestro', 'kimi:abc123,grok:xyz789'), true);
  assert.equal(esTokenValido('xyz789', 'maestro', 'kimi:abc123,grok:xyz789'), true);
});

test('esTokenValido rechaza el NOMBRE de la key, no solo el secreto', () => {
  // Regresion boba pero cara: si alguien invirtiera el parseo, 'kimi' pasaria.
  assert.equal(esTokenValido('kimi', 'maestro', 'kimi:abc123'), false);
});

test('esTokenValido rechaza un token que no figura en ningun lado', () => {
  assert.equal(esTokenValido('intruso', 'maestro', 'kimi:abc123'), false);
});

test('revocar una key es quitarla de la lista', () => {
  const antes = 'kimi:abc123,grok:xyz789';
  const despues = 'grok:xyz789';
  assert.equal(esTokenValido('abc123', 'maestro', antes), true);
  assert.equal(esTokenValido('abc123', 'maestro', despues), false);
});

// --- parseNombresTokens (visibilidad en /sistema) --------------------------
//
// Lo unico que esta funcion no puede hacer JAMAS es devolver un valor de token:
// alimenta la tabla de "Mis dispositivos", que se pinta en pantalla.

test('parseNombresTokens devuelve los nombres, nunca los secretos', () => {
  const nombres = parseNombresTokens('kimi:abc123,grok:xyz789');
  assert.deepEqual(nombres, ['kimi', 'grok']);
  assert.equal(nombres.includes('abc123'), false);
  assert.equal(nombres.includes('xyz789'), false);
});

test('parseNombresTokens omite las entradas sin nombre (formato viejo)', () => {
  // 'tokenpelado' no tiene ':': mostrarlo seria filtrar el token a la pantalla.
  assert.deepEqual(parseNombresTokens('tokenpelado,kimi:abc123'), ['kimi']);
  assert.deepEqual(parseNombresTokens(':abc123'), []);
});

test('parseNombresTokens tolera espacios y lista vacia', () => {
  assert.deepEqual(parseNombresTokens(' kimi : abc123 , grok:xyz789 '), ['kimi', 'grok']);
  assert.deepEqual(parseNombresTokens(undefined), []);
  assert.deepEqual(parseNombresTokens(''), []);
});
