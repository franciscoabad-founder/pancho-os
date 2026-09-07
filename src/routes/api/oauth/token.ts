// POST /api/oauth/token -- canje de codigo (authorization_code) y refresh
// (refresh_token). Publico por definicion (lo llama el cliente, no el navegador
// de Pancho), pero cada grant exige o PKCE o el client_secret del cliente
// confidencial. Responde el JSON estandar de OAuth: access_token, token_type,
// expires_in, refresh_token, scope.

import { createFileRoute } from '@tanstack/react-router';
import {
  obtenerCliente,
  canjearCodigo,
  refrescar,
  verificarCredencialCliente,
  ErrorOauth,
  ErrorScopeInvalido,
} from '../../../server/oauth.handlers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonOauth(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // OAuth 2.1: las respuestas de token no se cachean.
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...corsHeaders,
    },
  });
}

function errorOauth(error: string, descripcion: string, status = 400): Response {
  return jsonOauth({ error, error_description: descripcion }, status);
}

// Lee los parametros del body, sea form-urlencoded (lo estandar) o JSON.
async function leerParametros(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) if (v != null) out[k] = String(v);
    return out;
  }
  const form = await request.formData().catch(() => null);
  const out: Record<string, string> = {};
  if (form) for (const [k, v] of form.entries()) out[k] = String(v);
  return out;
}

// client_id / client_secret pueden venir por Basic auth (RFC 6749 2.3.1) o en el
// body (client_secret_post). Basic tiene prioridad si esta presente.
function credencialCliente(request: Request, params: Record<string, string>): { clientId: string; clientSecret: string | null } {
  const auth = request.headers.get('authorization');
  const basic = auth?.match(/^Basic\s+(.+)$/i)?.[1];
  if (basic) {
    try {
      const decoded = Buffer.from(basic, 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, idx)),
          clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
        };
      }
    } catch {
      // cae al body
    }
  }
  return { clientId: params.client_id ?? '', clientSecret: params.client_secret ?? null };
}

export const Route = createFileRoute('/api/oauth/token')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const params = await leerParametros(request);
        const grantType = params.grant_type ?? '';
        const { clientId, clientSecret } = credencialCliente(request, params);

        if (!clientId) return errorOauth('invalid_client', 'client_id requerido', 401);

        let cliente;
        try {
          cliente = await obtenerCliente(clientId);
        } catch {
          return errorOauth('server_error', 'no se pudo validar el cliente', 502);
        }
        if (!cliente) return errorOauth('invalid_client', 'cliente desconocido', 401);
        if (!verificarCredencialCliente(cliente, clientSecret)) {
          return errorOauth('invalid_client', 'autenticacion de cliente invalida', 401);
        }
        if (!cliente.grant_types.includes(grantType)) {
          return errorOauth('unauthorized_client', `grant_type no permitido para este cliente: ${grantType || '(vacio)'}`);
        }

        try {
          if (grantType === 'authorization_code') {
            const code = params.code ?? '';
            const redirectUri = params.redirect_uri ?? '';
            const codeVerifier = params.code_verifier ?? '';
            if (!code) return errorOauth('invalid_request', 'code requerido');
            if (!redirectUri) return errorOauth('invalid_request', 'redirect_uri requerido');
            if (!codeVerifier) return errorOauth('invalid_request', 'code_verifier requerido (PKCE)');
            const tokens = await canjearCodigo({ code, clientId, redirectUri, codeVerifier });
            return jsonOauth(tokens);
          }

          if (grantType === 'refresh_token') {
            const refreshToken = params.refresh_token ?? '';
            if (!refreshToken) return errorOauth('invalid_request', 'refresh_token requerido');
            const tokens = await refrescar(refreshToken, clientId);
            return jsonOauth(tokens);
          }

          return errorOauth('unsupported_grant_type', `grant_type no soportado: ${grantType || '(vacio)'}`);
        } catch (err) {
          if (err instanceof ErrorScopeInvalido) return errorOauth('invalid_scope', err.message);
          if (err instanceof ErrorOauth) return errorOauth(err.error, err.message, err.status);
          return errorOauth('server_error', 'error al emitir el token', 502);
        }
      },
    },
  },
});
