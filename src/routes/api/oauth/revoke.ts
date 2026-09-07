// POST /api/oauth/revoke -- revocacion de tokens (RFC 7009).
//
// Contrato RFC 7009: recibe `token` (y opcional token_type_hint) form-encoded o
// JSON, revoca la fila que matchee (por access_token_hash o refresh_token_hash)
// y responde 200 SIEMPRE, incluso si el token no existe o ya estaba revocado
// (no se le confirma a nadie si un token era valido). Un cliente confidencial
// que manda su client_secret se valida; si no lo manda, igual respondemos 200
// sin revocar nada ajeno (solo revoca lo que matchee el hash del token dado).

import { createFileRoute } from '@tanstack/react-router';
import { revocarToken, obtenerCliente, verificarCredencialCliente } from '../../../server/oauth.handlers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders },
  });
}

export const Route = createFileRoute('/api/oauth/revoke')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const params = await leerParametros(request);
        const token = params.token ?? '';
        if (!token) return ok(); // RFC 7009: nada que revocar, igual 200.

        // Autenticacion de cliente opcional: si viene client_id, lo validamos
        // (un client_secret incorrecto de un cliente confidencial no revoca).
        const clientId = params.client_id ?? '';
        if (clientId) {
          try {
            const cliente = await obtenerCliente(clientId);
            if (cliente && !verificarCredencialCliente(cliente, params.client_secret ?? null)) {
              // Credencial mala: no revocamos, pero respondemos 200 igual (no se
              // filtra si el token existia).
              return ok();
            }
          } catch {
            return ok();
          }
        }

        try {
          await revocarToken(token);
        } catch {
          // RFC 7009: aun ante error interno el cliente no necesita el detalle.
        }
        return ok();
      },
    },
  },
});
