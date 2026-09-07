// Logica pura del OAuth del MCP: PKCE S256, match exacto de redirect_uri,
// resolucion de scope con default seguro, y expiracion. Sin Supabase ni
// framework, corre con `node --test`.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularS256,
  verificarPkce,
  redirectUriPermitido,
  resolverScope,
  scopePermiteEscritura,
  estaExpirado,
  hashOpaco,
  igualSeguro,
  ErrorScopeInvalido,
  SCOPE_POR_DEFECTO,
} from './oauthCrypto.ts';

// --- PKCE S256 ---------------------------------------------------------------

// Vector canonico del RFC 7636 (apendice B).
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

test('calcularS256 coincide con el vector del RFC 7636', () => {
  assert.equal(calcularS256(RFC_VERIFIER), RFC_CHALLENGE);
});

test('verificarPkce acepta el verifier correcto con S256', () => {
  assert.equal(verificarPkce(RFC_VERIFIER, RFC_CHALLENGE, 'S256'), true);
});

test('verificarPkce rechaza un verifier incorrecto', () => {
  assert.equal(verificarPkce('otro-verifier-que-no-corresponde-al-challenge-x', RFC_CHALLENGE, 'S256'), false);
});

test('verificarPkce rechaza el metodo plain y cualquier cosa que no sea S256', () => {
  assert.equal(verificarPkce(RFC_VERIFIER, RFC_VERIFIER, 'plain'), false);
  assert.equal(verificarPkce(RFC_VERIFIER, RFC_CHALLENGE, 'S128'), false);
  // method ausente cae al default S256 (asi lo llama la route cuando el cliente
  // no manda code_challenge_method), y ahi el verifier correcto SI valida.
  assert.equal(verificarPkce(RFC_VERIFIER, RFC_CHALLENGE), true);
});

test('verificarPkce rechaza verifier fuera del rango 43-128 del RFC', () => {
  assert.equal(verificarPkce('corto', calcularS256('corto'), 'S256'), false);
});

test('verificarPkce rechaza valores vacios', () => {
  assert.equal(verificarPkce('', RFC_CHALLENGE, 'S256'), false);
  assert.equal(verificarPkce(RFC_VERIFIER, '', 'S256'), false);
});

// --- redirect_uri exacto -----------------------------------------------------

test('redirectUriPermitido exige match EXACTO', () => {
  const registradas = ['https://gemini.google.com/oauth/callback', 'https://chatgpt.com/connector/callback'];
  assert.equal(redirectUriPermitido('https://gemini.google.com/oauth/callback', registradas), true);
  // Un trailing slash de mas ya no matchea: es un origen distinto.
  assert.equal(redirectUriPermitido('https://gemini.google.com/oauth/callback/', registradas), false);
  // Otro path, otro host, o vacio: no.
  assert.equal(redirectUriPermitido('https://gemini.google.com/oauth/otro', registradas), false);
  assert.equal(redirectUriPermitido('https://malicioso.com/callback', registradas), false);
  assert.equal(redirectUriPermitido('', registradas), false);
  assert.equal(redirectUriPermitido(undefined, registradas), false);
});

// --- scope con default seguro ------------------------------------------------

test('resolverScope sin scope pedido cae al default seguro read', () => {
  assert.equal(resolverScope('', ['read', 'write']), 'read');
  assert.equal(resolverScope(undefined, ['read', 'write']), SCOPE_POR_DEFECTO);
});

test('resolverScope sin read en el cliente usa el primer scope registrado', () => {
  assert.equal(resolverScope('', ['write']), 'write');
});

test('resolverScope respeta lo pedido cuando es subconjunto de lo registrado', () => {
  assert.equal(resolverScope('write', ['read', 'write']), 'write');
  assert.equal(resolverScope('read write', ['read', 'write']), 'read write');
});

test('resolverScope rechaza un scope que el cliente no tiene registrado', () => {
  assert.throws(() => resolverScope('write', ['read']), ErrorScopeInvalido);
  assert.throws(() => resolverScope('admin', ['read', 'write']), ErrorScopeInvalido);
});

test('scopePermiteEscritura solo con write', () => {
  assert.equal(scopePermiteEscritura('read'), false);
  assert.equal(scopePermiteEscritura('read write'), true);
  assert.equal(scopePermiteEscritura('write'), true);
  assert.equal(scopePermiteEscritura(''), false);
  assert.equal(scopePermiteEscritura(null), false);
});

// --- expiracion --------------------------------------------------------------

test('estaExpirado distingue pasado, futuro e invalido', () => {
  const ahora = new Date('2026-09-06T12:00:00Z');
  assert.equal(estaExpirado(new Date('2026-09-06T11:59:59Z').toISOString(), ahora), true);
  assert.equal(estaExpirado(new Date('2026-09-06T12:00:01Z').toISOString(), ahora), false);
  assert.equal(estaExpirado(null, ahora), true);
  assert.equal(estaExpirado('no-es-fecha', ahora), true);
});

// --- hash / comparacion ------------------------------------------------------

test('hashOpaco es sha256 hex estable y igualSeguro compara bien', () => {
  const h = hashOpaco('secreto');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashOpaco('secreto'), h);
  assert.equal(igualSeguro(h, hashOpaco('secreto')), true);
  assert.equal(igualSeguro(h, hashOpaco('otro')), false);
  // Distinta longitud no lanza, devuelve false.
  assert.equal(igualSeguro('abc', 'abcd'), false);
});
