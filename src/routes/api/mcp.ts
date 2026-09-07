// Server route del endpoint MCP, portado de src/pages/api/mcp.ts (Astro).
//
// Igual que en la ruta de auth: el objeto de opciones de createFileRoute solo
// trae `server`, asi que el plugin de Start marca la ruta como server-only y la
// poda del arbol de rutas del cliente. Nada de esto llega al navegador.
//
// El middleware global (src/server/osAuthMiddleware.ts) deja pasar todo /api/
// sin cookie de sesion a proposito: cada endpoint valida su propia auth. Aca esa
// auth ahora tiene dos caminos (src/mcp/mcpAuth.ts): el token estatico
// OS_API_TOKEN / OS_API_TOKENS de siempre, y un bearer OAuth 2.1 emitido por el
// flujo de src/routes/api/oauth/** para que conectores estandar (Gemini,
// ChatGPT) se conecten pegando solo la URL.
//
// El protocolo JSON-RPC lo sigue resolviendo src/mcp/engine.ts, y la traduccion
// herramienta -> request de la API vive en src/mcp/osTools.ts.

import { createFileRoute } from '@tanstack/react-router';
import { handleMcpStatelessRequest, esHerramientaSoloLectura, type McpJsonRpcRequest } from '../../mcp/engine.ts';
import { executeOsTool } from '../../mcp/osTools.ts';
import { autenticarMcp, cabeceraWwwAuthenticate } from '../../mcp/mcpAuth.ts';
import { scopePermiteEscritura } from '../../server/oauthCrypto.ts';

// Algunos clientes MCP (Hermes incluido) mandan un preflight OPTIONS antes del
// POST real. Sin un handler propio, TanStack cae al router de paginas y devuelve
// el HTML del SPA, que el cliente MCP rechaza. Se agrega MCP-Protocol-Version a
// las cabeceras permitidas para el handshake de los clientes estandar.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OS-Token, Mcp-Method, Mcp-Name, MCP-Protocol-Version, Accept',
};

// Nombre del metodo, del header propio Mcp-Method o del body JSON-RPC.
function metodoDe(headers: Headers, body: McpJsonRpcRequest | undefined): string | undefined {
  return headers.get('Mcp-Method') ?? body?.method;
}

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async () =>
        new Response(
          JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Este endpoint es MCP stateless: usa POST con un body JSON-RPC.' } }),
          { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' } }
        ),

      POST: async ({ request }) => {
        // Auth primero: token estatico o bearer OAuth. Un 401 sale con
        // WWW-Authenticate apuntando al oauth-protected-resource, que es lo que
        // dispara el descubrimiento OAuth en Gemini/ChatGPT.
        const auth = await autenticarMcp(request);
        if (!auth.ok) return auth.response;

        const { actorNombrado, scope } = auth.identidad;
        const puedeEscribir = scopePermiteEscritura(scope);

        // MCP-Protocol-Version: si el cliente lo manda, se ecoa en la respuesta
        // (el spec pide validar/reflejar la version negociada).
        const protocolHeader = request.headers.get('MCP-Protocol-Version');

        let rawBody: McpJsonRpcRequest;
        try {
          rawBody = (await request.json()) as McpJsonRpcRequest;
        } catch (err) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: `Parse error: ${err instanceof Error ? err.message : String(err)}` },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Notificaciones JSON-RPC (notifications/initialized y demas): sin id y
        // sin respuesta. El spec MCP sobre HTTP pide 202 sin cuerpo.
        const metodo = metodoDe(request.headers, rawBody);
        if (metodo?.startsWith('notifications/')) {
          const headers: Record<string, string> = {};
          if (protocolHeader) headers['MCP-Protocol-Version'] = protocolHeader;
          return new Response(null, { status: 202, headers });
        }

        try {
          const responsePayload = await handleMcpStatelessRequest(
            rawBody,
            request.headers,
            (name, args) => {
              // Enforcement de scope: un token OAuth de solo lectura (sin
              // write) no puede invocar herramientas destructivas. El token
              // estatico tiene scope 'read write', asi que esto no lo toca y
              // Hermes sigue igual.
              if (!puedeEscribir && !esHerramientaSoloLectura(name)) {
                throw new Error(`insufficient_scope: el token no tiene permiso de escritura para '${name}'.`);
              }
              return executeOsTool(request, name, args, actorNombrado);
            },
          );

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Mcp-Version': '2026-07-28',
          };
          if (protocolHeader) headers['MCP-Protocol-Version'] = protocolHeader;

          return new Response(JSON.stringify(responsePayload), { status: 200, headers });
        } catch (err) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
    },
  },
});

// cabeceraWwwAuthenticate se reexporta para el test del contrato del 401.
export { cabeceraWwwAuthenticate };
