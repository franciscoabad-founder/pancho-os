// Autenticacion del endpoint MCP: token estatico (OS_API_TOKEN / OS_API_TOKENS)
// O bearer OAuth 2.1 (mcp_oauth_tokens). Modulo server-only (no entra al grafo
// del cliente), por eso puede importar oauth.handlers directo.
//
// Se extrajo de src/routes/api/mcp.ts para poder testear el handshake con bearer
// OAuth sin instanciar la server route de TanStack (src/mcp/mcpAuth.test.ts y
// oauth-mcp.test.ts inyectan un doble de Supabase y llaman esto directo).

import { esTokenValido, nombrePorToken } from '../lib/osTokens.ts';
import { readEnv } from '../lib/env.ts';
import { resolverAccessToken } from '../server/oauth.handlers.ts';

// Metadata del recurso protegido: es lo que el cliente estandar (Gemini,
// ChatGPT) lee del header WWW-Authenticate del 401 para arrancar el flujo OAuth
// pegando solo la URL del MCP.
export const RECURSO_MCP_METADATA = 'https://os.franciscoabad.com/.well-known/oauth-protected-resource';

export function cabeceraWwwAuthenticate(errorExtra?: { error: string; descripcion?: string }): string {
  const partes = [`Bearer resource_metadata="${RECURSO_MCP_METADATA}"`];
  if (errorExtra) {
    partes.push(`error="${errorExtra.error}"`);
    if (errorExtra.descripcion) partes.push(`error_description="${errorExtra.descripcion}"`);
  }
  return partes.join(', ');
}

export interface IdentidadMcp {
  // Nombre a propagar como actor real a executeOsTool (X-Os-Actor-Interno).
  // null = token maestro -> executeOsTool no propaga y queda como 'hermes'.
  actorNombrado: string | null;
  // Scope efectivo. El token estatico tiene acceso total ('read write'); el
  // bearer OAuth trae el scope que se le otorgo.
  scope: string;
  esOauth: boolean;
}

export type ResultadoAuthMcp =
  | { ok: true; identidad: IdentidadMcp }
  | { ok: false; response: Response };

function tokenDeRequest(request: Request): string | null {
  const xToken = request.headers.get('X-OS-Token');
  if (xToken) return xToken;
  const auth = request.headers.get('Authorization');
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? null;
}

// Arma el 401 JSON-RPC con WWW-Authenticate. Mismo cuerpo que devolvia mcp.ts
// antes; lo nuevo es el header que dispara el descubrimiento OAuth.
function respuesta401(mensaje: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: mensaje },
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': cabeceraWwwAuthenticate(),
      },
    },
  );
}

export async function autenticarMcp(request: Request): Promise<ResultadoAuthMcp> {
  const token = tokenDeRequest(request);
  if (!token) {
    return { ok: false, response: respuesta401('Unauthorized: falta X-OS-Token o Bearer token.') };
  }

  // 1. Token estatico del .env (Hermes, n8n, keys con nombre). Acceso total.
  const expectedToken = readEnv('OS_API_TOKEN');
  const listaTokens = readEnv('OS_API_TOKENS');
  if (expectedToken && esTokenValido(token, expectedToken, listaTokens)) {
    const actorNombrado = token === expectedToken ? null : nombrePorToken(listaTokens, token);
    return { ok: true, identidad: { actorNombrado, scope: 'read write', esOauth: false } };
  }

  // 2. Bearer OAuth: se resuelve contra mcp_oauth_tokens (hash, no revocado, no
  //    expirado). El actor es el client_name registrado, el scope el otorgado.
  const oauth = await resolverAccessToken(token);
  if (oauth) {
    return { ok: true, identidad: { actorNombrado: oauth.actor, scope: oauth.scope, esOauth: true } };
  }

  return { ok: false, response: respuesta401('Unauthorized: token invalido, revocado o expirado.') };
}
