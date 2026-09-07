// Documentos de descubrimiento OAuth 2.1 / MCP (.well-known) y su servidor.
//
// Por que vive aca y no solo como archivos estaticos en public/.well-known:
// TanStack ignora directorios que empiezan con punto, asi que no se puede crear
// una server route para /.well-known/*. En produccion Nitro SI sirve los
// archivos de public/ (incluida .well-known) antes de llegar al handler de
// Start, por eso los dejamos tambien ahi. Pero para que el flujo funcione en dev
// y no dependa de que el static serving de dotfiles se comporte igual en todos
// los entornos, el middleware global (osAuthMiddleware.ts) sirve estos dos
// documentos desde aca. Los dos caminos devuelven el MISMO JSON: si tocas uno,
// toca el otro (public/.well-known/*).
//
// Modulo puro (sin framework) para poder testearlo y para que el middleware lo
// use sin acoplar la politica de acceso a nada de OAuth.

export const OAUTH_ISSUER = 'https://os.franciscoabad.com';
const MCP_RESOURCE = `${OAUTH_ISSUER}/api/mcp`;

// RFC 9728 (OAuth 2.0 Protected Resource Metadata): le dice al cliente que este
// recurso (el MCP) se protege con los authorization servers listados.
export const PROTECTED_RESOURCE_METADATA = {
  resource: MCP_RESOURCE,
  authorization_servers: [OAUTH_ISSUER],
  scopes_supported: ['read', 'write'],
  bearer_methods_supported: ['header'],
} as const;

// RFC 8414 (OAuth 2.0 Authorization Server Metadata). SIN registration_endpoint
// a proposito: no exponemos registro dinamico de clientes (los clientes se
// pre-registran a mano con scripts/mcp-oauth-register.ts). Solo S256, solo code
// como response_type, y los dos grants que implementamos.
export const AUTHORIZATION_SERVER_METADATA = {
  issuer: OAUTH_ISSUER,
  authorization_endpoint: `${OAUTH_ISSUER}/api/oauth/authorize`,
  token_endpoint: `${OAUTH_ISSUER}/api/oauth/token`,
  revocation_endpoint: `${OAUTH_ISSUER}/api/oauth/revoke`,
  scopes_supported: ['read', 'write'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
} as const;

export const RUTA_PROTECTED_RESOURCE = '/.well-known/oauth-protected-resource';
export const RUTA_AUTHORIZATION_SERVER = '/.well-known/oauth-authorization-server';

// Devuelve la respuesta JSON del documento .well-known que corresponda al
// pathname, o undefined si no es uno de los dos. Cache-Control publico y corto:
// son documentos estables pero un cliente no deberia clavarlos para siempre.
export function respuestaMetadataOauth(pathname: string): Response | undefined {
  let cuerpo: unknown;
  if (pathname === RUTA_PROTECTED_RESOURCE) cuerpo = PROTECTED_RESOURCE_METADATA;
  else if (pathname === RUTA_AUTHORIZATION_SERVER) cuerpo = AUTHORIZATION_SERVER_METADATA;
  else return undefined;

  return new Response(JSON.stringify(cuerpo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      // El descubrimiento tiene que poder leerse desde cualquier origen: los
      // conectores lo piden con un fetch cross-origin antes de tener token.
      'Access-Control-Allow-Origin': '*',
    },
  });
}
