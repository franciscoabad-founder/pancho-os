// Criptografia y logica pura del OAuth 2.1 del MCP.
//
// DELIBERADAMENTE puro: solo node:crypto, ni Supabase ni framework. Dos razones,
// las mismas que src/server/deviceAuth.ts:
//   1. Se testea con `node --test` sin levantar nada (oauthCrypto.test.ts).
//   2. src/server/osAuth.ts (que esta en el grafo del cliente) puede necesitar
//      helpers de aca sin arrastrar @supabase/supabase-js al navegador.
//
// Regla del modelo de seguridad, sin excepciones: el valor crudo de un codigo,
// token o secreto de cliente existe en memoria el tiempo de una request y viaja
// UNA vez al cliente. Lo unico que se persiste es su sha256. Un dump de la base
// no alcanza para autenticarse ni para robar un codigo en vuelo.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// --- Vidas y scopes ----------------------------------------------------------

// Access token: 1h. Corto para acotar el dano de una fuga; el cliente lo renueva
// con el refresh token sin volver a pedirle nada a Pancho.
export const ACCESS_TOKEN_TTL_S = 60 * 60;
// Codigo de autorizacion: 60s. Solo tiene que sobrevivir el redirect del browser
// al cliente y el canje inmediato en /token. OAuth 2.1 recomienda <= 60s.
export const AUTH_CODE_TTL_MS = 60 * 1000;
// Refresh token: 30 dias. Se rota en cada uso, asi que su vida real es "hasta
// que el cliente deje de usarlo 30 dias seguidos".
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30;

// Lista cerrada de scopes. read = solo lectura; write = puede crear/modificar/
// borrar. El default seguro es read (ver resolverScope).
export const SCOPES_SOPORTADOS = ['read', 'write'] as const;
export type ScopeOs = (typeof SCOPES_SOPORTADOS)[number];
export const SCOPE_POR_DEFECTO: ScopeOs = 'read';

// --- Generacion de secretos --------------------------------------------------

// 32 bytes = 256 bits de entropia en base64url (43 chars sin padding, copiables
// sin escapes). Sirve para codigos, access y refresh tokens.
export function generarSecretoOpaco(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

// client_id NO es secreto (viaja en URLs de /authorize), pero conviene que sea
// unico e inconfundible. Prefijo mcp_ para reconocerlo de un vistazo en la base.
export function generarClientId(): string {
  return `mcp_${randomBytes(16).toString('hex')}`;
}

// client_secret si es secreto: mismo tamano que un token.
export function generarSecretoCliente(): string {
  return generarSecretoOpaco(32);
}

// sha256 hex. Es lo unico que va a la base para codigos, tokens y secretos.
export function hashOpaco(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

// Comparacion en tiempo constante de dos strings ya normalizados (hex/base64url).
// Evita el oraculo de tiempo al comparar un secreto presentado contra el hash
// esperado. Distinta longitud -> false sin comparar byte a byte.
export function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// --- PKCE (solo S256) --------------------------------------------------------

// base64url(sha256(verifier)). El verifier se recibe como ASCII (RFC 7636).
export function calcularS256(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}

// Verifica un code_verifier contra el code_challenge guardado. Solo S256: el
// metodo 'plain' no se acepta (OAuth 2.1 lo prohibe para clientes publicos y no
// lo queremos ni para confidenciales). En tiempo constante.
export function verificarPkce(
  codeVerifier: string | null | undefined,
  codeChallenge: string | null | undefined,
  method: string | null | undefined = 'S256',
): boolean {
  if (method !== 'S256') return false;
  if (!codeVerifier || !codeChallenge) return false;
  // RFC 7636: el verifier es de 43 a 128 caracteres del set unreserved.
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  return igualSeguro(calcularS256(codeVerifier), codeChallenge);
}

// --- redirect_uri (match exacto) ---------------------------------------------

// Match EXACTO contra la lista registrada del cliente. Sin normalizar, sin
// prefijos, sin comodines: es la unica barrera contra que un code se redirija a
// un origen del atacante. Un redirect_uri que no este identico en la lista se
// rechaza.
export function redirectUriPermitido(uri: unknown, registradas: readonly string[]): boolean {
  return typeof uri === 'string' && uri.length > 0 && registradas.includes(uri);
}

// --- application_type (pre-registro, SEP-837) --------------------------------

// 2026-07-28 exige que el cliente declare un application_type apropiado al
// registrarse para evitar conflictos de redirect_uri (OpenID Connect
// Registration). No hay DCR abierto: esto se "honra" validando, en el
// pre-registro manual, que los redirect_uris registrados sean coherentes con el
// tipo. No requiere columna nueva: la barrera real en /authorize sigue siendo el
// match exacto contra redirect_uris. Por eso no se persiste el tipo.
export const APPLICATION_TYPES = ['web', 'native'] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];
export const APPLICATION_TYPE_POR_DEFECTO: ApplicationType = 'web';

export class ErrorApplicationType extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorApplicationType';
  }
}

// Valida un application_type y sus redirect_uris. Reglas (OIDC Registration):
//   - web:    redirect_uri https, host distinto de localhost/127.0.0.1.
//   - native: http SOLO contra localhost/127.0.0.1 (loopback), o un esquema
//             propio no-http (p.ej. com.app:/cb). Nunca https publico.
// Devuelve el tipo normalizado o lanza ErrorApplicationType.
export function validarApplicationType(
  applicationType: string | null | undefined,
  redirectUris: readonly string[],
): ApplicationType {
  const tipo = (applicationType?.trim() || APPLICATION_TYPE_POR_DEFECTO) as ApplicationType;
  if (!(APPLICATION_TYPES as readonly string[]).includes(tipo)) {
    throw new ErrorApplicationType(`application_type invalido: ${applicationType}. Use 'web' o 'native'.`);
  }

  const esLoopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  for (const uri of redirectUris) {
    let u: URL;
    try {
      u = new URL(uri);
    } catch {
      throw new ErrorApplicationType(`redirect_uri no es una URL valida: ${uri}`);
    }
    if (tipo === 'web') {
      if (u.protocol !== 'https:') {
        throw new ErrorApplicationType(`application_type=web exige redirect_uri https: ${uri}`);
      }
      if (esLoopback(u.hostname)) {
        throw new ErrorApplicationType(`application_type=web no admite redirect_uri a localhost: ${uri}. Use application_type=native.`);
      }
    } else {
      // native
      if (u.protocol === 'https:') {
        throw new ErrorApplicationType(`application_type=native no admite https publico: ${uri}. Use loopback http o un esquema propio.`);
      }
      if (u.protocol === 'http:' && !esLoopback(u.hostname)) {
        throw new ErrorApplicationType(`application_type=native solo admite http contra loopback (localhost/127.0.0.1): ${uri}`);
      }
    }
  }
  return tipo;
}

// --- scope -------------------------------------------------------------------

export class ErrorScopeInvalido extends Error {
  constructor(message = 'invalid_scope') {
    super(message);
    this.name = 'ErrorScopeInvalido';
  }
}

// Resuelve el scope efectivo de un token a partir de lo que pidio el cliente y
// lo que tiene registrado. Reglas:
//   - Sin scope pedido -> default seguro: 'read' si el cliente lo tiene, si no
//     el primero de sus scopes registrados.
//   - Con scope pedido -> cada uno TIENE que estar en los registrados del
//     cliente; si alguno no lo esta, es invalid_scope (no se degrada en
//     silencio). El resultado es exactamente lo pedido, ya validado.
// El scope del token NUNCA sale del body de /token sin pasar por esta puerta:
// siempre queda acotado a lo que el cliente registrado puede tener.
export function resolverScope(
  pedido: string | null | undefined,
  registrados: readonly string[],
): string {
  const permitidos = registrados.length ? registrados : [SCOPE_POR_DEFECTO];
  const set = new Set(permitidos);

  if (!pedido || !pedido.trim()) {
    return set.has(SCOPE_POR_DEFECTO) ? SCOPE_POR_DEFECTO : permitidos[0]!;
  }

  const pedidos = pedido.trim().split(/\s+/);
  for (const s of pedidos) {
    if (!set.has(s)) throw new ErrorScopeInvalido(`invalid_scope: ${s}`);
  }
  // Dedupe conservando el orden pedido.
  return [...new Set(pedidos)].join(' ');
}

// Un scope (string separado por espacios) concede escritura solo si incluye
// 'write'. Lo usa el MCP para rechazar herramientas destructivas a un token de
// solo lectura.
export function scopePermiteEscritura(scope: string | null | undefined): boolean {
  if (!scope) return false;
  return scope.split(/\s+/).includes('write');
}

// --- expiracion --------------------------------------------------------------

export function estaExpirado(expiresAt: string | Date | null | undefined, ahora: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const t = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isNaN(t) || t <= ahora.getTime();
}
