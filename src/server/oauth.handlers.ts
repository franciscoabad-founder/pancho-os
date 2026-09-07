// Logica de negocio del OAuth 2.1 del MCP: todo lo que toca Supabase.
//
// Mismo patron que src/server/devices.handlers.ts: aca no hay Request, Response
// ni framework. Los errores de negocio viajan como ErrorOauth con su codigo
// OAuth (RFC 6749 seccion 5.2) y su status HTTP; las server routes de
// src/routes/api/oauth/** los traducen a JSON.
//
// La cripto y la logica pura viven aparte, en src/server/oauthCrypto.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import {
  ACCESS_TOKEN_TTL_S,
  AUTH_CODE_TTL_MS,
  ErrorScopeInvalido,
  estaExpirado,
  generarClientId,
  generarSecretoCliente,
  generarSecretoOpaco,
  hashOpaco,
  igualSeguro,
  redirectUriPermitido,
  resolverScope,
  verificarPkce,
} from './oauthCrypto.ts';

export const TABLA_CLIENTS = 'mcp_oauth_clients';
export const TABLA_CODES = 'mcp_oauth_auth_codes';
export const TABLA_TOKENS = 'mcp_oauth_tokens';

// Seam para tests, mismo patron que setClienteSupabaseDevices: en produccion
// resuelve a getSupabaseServer(); los tests inyectan un doble en memoria.
let clienteActual: () => SupabaseClient = getSupabaseServer;

/** Solo para tests: inyecta un cliente Supabase (o doble) distinto. */
export function setClienteSupabaseOauth(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

// Error con codigo OAuth. `error` es el codigo del estandar (invalid_grant,
// invalid_client, invalid_scope, ...), `status` el HTTP con el que responde la
// route.
export class ErrorOauth extends Error {
  readonly error: string;
  readonly status: number;
  constructor(error: string, descripcion: string, status = 400) {
    super(descripcion);
    this.name = 'ErrorOauth';
    this.error = error;
    this.status = status;
  }
}

export interface ClienteOauth {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  scopes: string[];
  created_at: string;
  created_by: string | null;
}

// --- registro de clientes (lo usa el CLI, no hay endpoint publico) -----------

export interface AltaCliente {
  client_name: string;
  redirect_uris: string[];
  scopes?: string[];
  grant_types?: string[];
  created_by?: string;
  publico?: boolean; // true = sin client_secret (cliente publico, solo PKCE)
}

export interface ClienteRegistrado {
  client_id: string;
  client_secret: string | null;
  client_name: string;
  redirect_uris: string[];
  scopes: string[];
  grant_types: string[];
}

export async function registrarCliente(alta: AltaCliente): Promise<ClienteRegistrado> {
  const clientName = String(alta.client_name ?? '').trim();
  if (!clientName) throw new ErrorOauth('invalid_client_metadata', 'client_name requerido');
  const redirectUris = (alta.redirect_uris ?? []).map((u) => String(u).trim()).filter(Boolean);
  if (!redirectUris.length) throw new ErrorOauth('invalid_redirect_uri', 'al menos un redirect_uri requerido');

  const scopes = (alta.scopes?.length ? alta.scopes : ['read']).map((s) => String(s).trim()).filter(Boolean);
  const grantTypes = alta.grant_types?.length ? alta.grant_types : ['authorization_code', 'refresh_token'];

  const clientId = generarClientId();
  const clientSecret = alta.publico ? null : generarSecretoCliente();

  const sb = clienteActual();
  const { error } = await sb.from(TABLA_CLIENTS).insert([{
    client_id: clientId,
    client_secret_hash: clientSecret ? hashOpaco(clientSecret) : null,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    scopes,
    created_by: alta.created_by ?? 'cli',
  }]);
  if (error) throw error;

  return {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: clientName,
    redirect_uris: redirectUris,
    scopes,
    grant_types: grantTypes,
  };
}

export async function obtenerCliente(clientId: string | null | undefined): Promise<ClienteOauth | null> {
  if (!clientId) return null;
  const sb = clienteActual();
  const { data, error } = await sb
    .from(TABLA_CLIENTS)
    .select('client_id, client_secret_hash, client_name, redirect_uris, grant_types, scopes, created_at, created_by')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClienteOauth | null) ?? null;
}

// Autenticacion del cliente en /token y /revoke. Un cliente confidencial (tiene
// client_secret_hash) DEBE presentar el secreto correcto. Uno publico
// (client_secret_hash nulo) se autentica solo con PKCE y no lleva secreto.
export function verificarCredencialCliente(cliente: ClienteOauth, secretoPresentado: string | null | undefined): boolean {
  if (!cliente.client_secret_hash) return true; // publico
  if (!secretoPresentado) return false;
  return igualSeguro(hashOpaco(secretoPresentado), cliente.client_secret_hash);
}

// --- /authorize: emitir el codigo --------------------------------------------

export interface DatosCodigo {
  cliente: ClienteOauth;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  actor: string;
}

// Emite un codigo de autorizacion crudo (lo devuelve una sola vez) y guarda su
// hash. Valida cliente, redirect_uri exacto, S256 y scope contra el cliente.
export async function emitirCodigo(datos: DatosCodigo): Promise<string> {
  if (!redirectUriPermitido(datos.redirectUri, datos.cliente.redirect_uris)) {
    throw new ErrorOauth('invalid_request', 'redirect_uri no registrado', 400);
  }
  if (datos.codeChallengeMethod !== 'S256' || !datos.codeChallenge) {
    throw new ErrorOauth('invalid_request', 'se requiere PKCE con code_challenge_method=S256', 400);
  }
  const scope = resolverScope(datos.scope, datos.cliente.scopes);

  const codigo = generarSecretoOpaco(32);
  const sb = clienteActual();
  const { error } = await sb.from(TABLA_CODES).insert([{
    code_hash: hashOpaco(codigo),
    client_id: datos.cliente.client_id,
    redirect_uri: datos.redirectUri,
    code_challenge: datos.codeChallenge,
    code_challenge_method: 'S256',
    scope,
    actor: datos.actor,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  }]);
  if (error) throw error;
  return codigo;
}

// --- /token: respuesta comun -------------------------------------------------

export interface RespuestaTokens {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function emitirTokens(clientId: string, scope: string, actor: string): Promise<RespuestaTokens> {
  const accessToken = generarSecretoOpaco(32);
  const refreshToken = generarSecretoOpaco(32);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString();

  const sb = clienteActual();
  const { error } = await sb.from(TABLA_TOKENS).insert([{
    access_token_hash: hashOpaco(accessToken),
    refresh_token_hash: hashOpaco(refreshToken),
    client_id: clientId,
    scope,
    actor,
    expires_at: expiresAt,
  }]);
  if (error) throw error;

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope,
  };
}

// --- /token grant_type=authorization_code ------------------------------------

export interface CanjeCodigo {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

export async function canjearCodigo(entrada: CanjeCodigo): Promise<RespuestaTokens> {
  const sb = clienteActual();

  const { data: fila, error } = await sb
    .from(TABLA_CODES)
    .select('code_hash, client_id, redirect_uri, code_challenge, code_challenge_method, scope, actor, expires_at, used_at')
    .eq('code_hash', hashOpaco(entrada.code))
    .maybeSingle();
  if (error) throw error;
  if (!fila) throw new ErrorOauth('invalid_grant', 'codigo invalido');

  // El client_id del canje tiene que ser el mismo que pidio el codigo, y el
  // redirect_uri tiene que coincidir con el que quedo grabado (RFC 6749 4.1.3).
  if (fila.client_id !== entrada.clientId) throw new ErrorOauth('invalid_grant', 'el codigo no pertenece a este cliente');
  if (fila.redirect_uri !== entrada.redirectUri) throw new ErrorOauth('invalid_grant', 'redirect_uri no coincide con el del codigo');
  if (fila.used_at) throw new ErrorOauth('invalid_grant', 'el codigo ya fue usado');
  if (estaExpirado(fila.expires_at as string)) throw new ErrorOauth('invalid_grant', 'el codigo vencio');

  if (!verificarPkce(entrada.codeVerifier, fila.code_challenge as string, fila.code_challenge_method as string)) {
    throw new ErrorOauth('invalid_grant', 'code_verifier no valida el PKCE');
  }

  // Marca de un solo uso con candado: update condicional a used_at null. Si dos
  // canjes llegan juntos, uno actualiza cero filas y se va con invalid_grant en
  // vez de que los dos emitan tokens del mismo codigo.
  const usadoEn = new Date().toISOString();
  const { data: marcadas, error: errMarca } = await sb
    .from(TABLA_CODES)
    .update({ used_at: usadoEn })
    .eq('code_hash', fila.code_hash)
    .is('used_at', null)
    .select('code_hash');
  if (errMarca) throw errMarca;
  if (!marcadas || marcadas.length === 0) throw new ErrorOauth('invalid_grant', 'el codigo ya fue usado');

  return emitirTokens(fila.client_id as string, fila.scope as string, fila.actor as string);
}

// --- /token grant_type=refresh_token -----------------------------------------

export async function refrescar(refreshToken: string, clientId: string): Promise<RespuestaTokens> {
  const sb = clienteActual();
  const { data: fila, error } = await sb
    .from(TABLA_TOKENS)
    .select('access_token_hash, refresh_token_hash, client_id, scope, actor, revoked_at')
    .eq('refresh_token_hash', hashOpaco(refreshToken))
    .maybeSingle();
  if (error) throw error;
  if (!fila) throw new ErrorOauth('invalid_grant', 'refresh_token invalido');
  if (fila.client_id !== clientId) throw new ErrorOauth('invalid_grant', 'el refresh_token no pertenece a este cliente');
  if (fila.revoked_at) throw new ErrorOauth('invalid_grant', 'refresh_token revocado');

  // Rotacion: se revoca la fila vieja (con candado a revoked_at null) y nace una
  // nueva. Si el update no toca nada, alguien ya lo roto: invalid_grant.
  const { data: revocadas, error: errRev } = await sb
    .from(TABLA_TOKENS)
    .update({ revoked_at: new Date().toISOString() })
    .eq('refresh_token_hash', fila.refresh_token_hash)
    .is('revoked_at', null)
    .select('access_token_hash');
  if (errRev) throw errRev;
  if (!revocadas || revocadas.length === 0) throw new ErrorOauth('invalid_grant', 'refresh_token ya rotado');

  return emitirTokens(fila.client_id as string, fila.scope as string, fila.actor as string);
}

// --- resolucion del access token (la usa el MCP) -----------------------------

export interface IdentidadOauth {
  actor: string;
  scope: string;
  clientId: string;
}

// Resuelve un access token crudo a su identidad, o null si no vale (no existe,
// revocado o expirado). NO lanza por tabla inexistente ni por Supabase caido:
// quien llama (el MCP / osAuth) necesita que este camino falle en silencio hacia
// "no autorizado", igual que verificarTokenDispositivo.
export async function resolverAccessToken(token: string | null | undefined): Promise<IdentidadOauth | null> {
  if (!token) return null;
  try {
    const sb = clienteActual();
    const { data, error } = await sb
      .from(TABLA_TOKENS)
      .select('client_id, scope, actor, expires_at, revoked_at')
      .eq('access_token_hash', hashOpaco(token))
      .maybeSingle();
    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (estaExpirado(data.expires_at as string)) return null;
    return { actor: data.actor as string, scope: data.scope as string, clientId: data.client_id as string };
  } catch {
    return null;
  }
}

// --- /revoke (RFC 7009) ------------------------------------------------------

// Revoca por access_token_hash o por refresh_token_hash. RFC 7009: la respuesta
// es 200 aunque el token no exista, asi que esto nunca lanza por "no encontrado";
// devuelve cuantas filas toco solo por si el caller quiere loguear.
export async function revocarToken(token: string | null | undefined): Promise<number> {
  if (!token) return 0;
  const sb = clienteActual();
  const hash = hashOpaco(token);
  let tocadas = 0;
  for (const columna of ['access_token_hash', 'refresh_token_hash']) {
    const { data, error } = await sb
      .from(TABLA_TOKENS)
      .update({ revoked_at: new Date().toISOString() })
      .eq(columna, hash)
      .is('revoked_at', null)
      .select('access_token_hash');
    if (error) throw error;
    tocadas += data?.length ?? 0;
  }
  return tocadas;
}

// Reexport para que las routes armen respuestas de scope invalido sin importar
// dos modulos.
export { ErrorScopeInvalido };
