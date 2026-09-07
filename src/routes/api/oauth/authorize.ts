// GET/POST /api/oauth/authorize -- endpoint de autorizacion OAuth 2.1 con
// pantalla de consentimiento.
//
// Lecciones de seguridad de gbrain, aplicadas desde el inicio:
//   (1) EXIGE sesion del dueno (cookie os_auth) y muestra consentimiento ANTES
//       de emitir el code. Nunca auto-aprueba.
//   (2) Sin registro dinamico: el cliente tiene que estar pre-registrado
//       (mcp_oauth_clients). Un client_id desconocido no llega ni a la pantalla.
//   (3) redirect_uri se valida por match EXACTO contra la lista registrada,
//       tanto en el GET como en el POST (nunca se confia en el hidden del form).
//   (4) el code crudo solo se guarda como sha256 (ver oauth.handlers.ts).
//
// GET: si no hay sesion -> 302 a /login?next=<esta url>. Si hay -> pinta el
// consentimiento. POST (boton aprobar): re-valida todo, emite el code y redirige
// al redirect_uri con code+state.

import { createFileRoute } from '@tanstack/react-router';
import { tieneSesionOs, origenPermitido } from '../../../server/osAuth.ts';
import { obtenerCliente, emitirCodigo, ErrorOauth } from '../../../server/oauth.handlers.ts';
import { redirectUriPermitido, resolverScope, ErrorScopeInvalido } from '../../../server/oauthCrypto.ts';
import { OAUTH_ISSUER } from '../../../server/oauthMetadata.ts';

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function paginaError(mensaje: string, status = 400): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Error de autorizacion</title></head>
<body style="font-family:system-ui,sans-serif;background:#071132;color:#E8EAF0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:420px;padding:2rem;background:rgba(26,43,107,.55);border:1px solid rgba(59,78,217,.3);border-radius:16px">
<h1 style="font-size:1.1rem;margin:0 0 .5rem">No se pudo autorizar</h1>
<p style="color:#ffb4ab;font-size:.9rem">${escapeHtml(mensaje)}</p>
</div></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Redirige al cliente con un error OAuth en el query (solo si el redirect_uri ya
// se valido como registrado). Incluye `iss` (RFC 9207): la validacion del issuer
// aplica tambien a las respuestas de error.
function redirigirConError(redirectUri: string, error: string, state: string | null): Response {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (state) url.searchParams.set('state', state);
  url.searchParams.set('iss', OAUTH_ISSUER);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

function redirigirLogin(request: Request): Response {
  const u = new URL(request.url);
  const next = `${u.pathname}${u.search}`;
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?next=${encodeURIComponent(next)}` },
  });
}

function paginaConsentimiento(params: {
  clientName: string;
  scope: string;
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
}): Response {
  const scopesTexto = params.scope
    .split(/\s+/)
    .map((s) => (s === 'write' ? 'Leer y escribir (crear, modificar, borrar)' : s === 'read' ? 'Solo lectura' : s))
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');

  const hidden = (name: string, value: string | null) =>
    value == null ? '' : `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Conectar con Pancho OS</title></head>
<body style="font-family:system-ui,sans-serif;background:#071132;color:#E8EAF0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1rem">
<div style="max-width:420px;width:100%;padding:2.5rem 2rem;background:rgba(26,43,107,.55);border:1px solid rgba(59,78,217,.3);border-radius:16px;box-shadow:0 18px 48px rgba(14,23,56,.4)">
<p style="font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#6B7AE8;margin:0 0 1.5rem">OS · Francisco Abad</p>
<h1 style="font-size:1.25rem;margin:0 0 .75rem">Autorizar conexion</h1>
<p style="font-size:.9rem;color:#AeB4C8;line-height:1.5;margin:0 0 1rem"><strong>${escapeHtml(params.clientName)}</strong> quiere conectarse a tu Pancho OS por MCP con estos permisos:</p>
<ul style="font-size:.9rem;color:#E8EAF0;line-height:1.6;margin:0 0 1.5rem;padding-left:1.2rem">${scopesTexto}</ul>
<form method="POST" action="/api/oauth/authorize">
${hidden('client_id', params.clientId)}
${hidden('redirect_uri', params.redirectUri)}
${hidden('scope', params.scope)}
${hidden('state', params.state)}
${hidden('code_challenge', params.codeChallenge)}
${hidden('code_challenge_method', params.codeChallengeMethod)}
${hidden('response_type', 'code')}
<button type="submit" name="decision" value="approve" style="width:100%;background:#3B4ED9;border:none;border-radius:8px;padding:.8rem 1rem;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff;cursor:pointer;margin-bottom:.6rem">Aprobar</button>
<button type="submit" name="decision" value="deny" style="width:100%;background:transparent;border:1px solid rgba(232,234,240,.2);border-radius:8px;padding:.7rem 1rem;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#AeB4C8;cursor:pointer">Rechazar</button>
</form>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const Route = createFileRoute('/api/oauth/authorize')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Sin sesion del dueno no se muestra nada: primero login, con next de
        // vuelta a esta misma URL de authorize.
        if (!tieneSesionOs(request)) return redirigirLogin(request);

        const url = new URL(request.url);
        const clientId = url.searchParams.get('client_id');
        const redirectUri = url.searchParams.get('redirect_uri');
        const responseType = url.searchParams.get('response_type');
        const scope = url.searchParams.get('scope');
        const state = url.searchParams.get('state');
        const codeChallenge = url.searchParams.get('code_challenge');
        const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? 'S256';

        let cliente;
        try {
          cliente = await obtenerCliente(clientId);
        } catch {
          return paginaError('No se pudo validar el cliente (error del servidor).', 502);
        }
        if (!cliente) return paginaError('client_id desconocido. El cliente no esta registrado.');
        // redirect_uri EXACTO: si no matchea, no se redirige (seria mandar el
        // flujo a un origen no confiable); se muestra el error aca.
        if (!redirectUri || !redirectUriPermitido(redirectUri, cliente.redirect_uris)) {
          return paginaError('redirect_uri no coincide con ninguno registrado para este cliente.');
        }

        // A partir de aca el redirect_uri es de confianza: los errores del
        // protocolo se devuelven por redirect, como pide OAuth.
        if (responseType !== 'code') return redirigirConError(redirectUri, 'unsupported_response_type', state);
        if (codeChallengeMethod !== 'S256' || !codeChallenge) {
          return redirigirConError(redirectUri, 'invalid_request', state);
        }

        let scopeEfectivo: string;
        try {
          scopeEfectivo = resolverScope(scope, cliente.scopes);
        } catch (err) {
          if (err instanceof ErrorScopeInvalido) return redirigirConError(redirectUri, 'invalid_scope', state);
          throw err;
        }

        return paginaConsentimiento({
          clientName: cliente.client_name,
          scope: scopeEfectivo,
          clientId: cliente.client_id,
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
        });
      },

      POST: async ({ request }) => {
        // CSRF: este POST acuña una credencial usando la cookie de sesion, y el
        // CSRF middleware de src/start.ts no cubre server routes. Mismo criterio
        // que pair/confirm (ver origenPermitido).
        if (!origenPermitido(request)) return paginaError('origen no permitido', 403);
        if (!tieneSesionOs(request)) return redirigirLogin(request);

        const form = await request.formData();
        const clientId = String(form.get('client_id') ?? '');
        const redirectUri = String(form.get('redirect_uri') ?? '');
        const scope = form.get('scope') ? String(form.get('scope')) : null;
        const state = form.get('state') ? String(form.get('state')) : null;
        const codeChallenge = String(form.get('code_challenge') ?? '');
        const codeChallengeMethod = String(form.get('code_challenge_method') ?? 'S256');
        const decision = String(form.get('decision') ?? '');

        let cliente;
        try {
          cliente = await obtenerCliente(clientId);
        } catch {
          return paginaError('No se pudo validar el cliente (error del servidor).', 502);
        }
        if (!cliente) return paginaError('client_id desconocido.');
        // Nunca confiar en el hidden: se re-valida el redirect_uri contra la base.
        if (!redirectUriPermitido(redirectUri, cliente.redirect_uris)) {
          return paginaError('redirect_uri no coincide con ninguno registrado.');
        }

        if (decision !== 'approve') return redirigirConError(redirectUri, 'access_denied', state);

        try {
          const code = await emitirCodigo({
            cliente,
            redirectUri,
            scope: scope ?? '',
            codeChallenge,
            codeChallengeMethod,
            actor: cliente.client_name,
          });
          const url = new URL(redirectUri);
          url.searchParams.set('code', code);
          if (state) url.searchParams.set('state', state);
          // iss (RFC 9207): el cliente lo compara contra el issuer registrado
          // antes de canjear el code. Lo anunciamos en la AS metadata con
          // authorization_response_iss_parameter_supported:true.
          url.searchParams.set('iss', OAUTH_ISSUER);
          return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
        } catch (err) {
          if (err instanceof ErrorScopeInvalido) return redirigirConError(redirectUri, 'invalid_scope', state);
          if (err instanceof ErrorOauth) return redirigirConError(redirectUri, err.error, state);
          return paginaError('No se pudo emitir el codigo de autorizacion.', 502);
        }
      },
    },
  },
});
