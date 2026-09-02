// Server route del endpoint MCP, portado de src/pages/api/mcp.ts (Astro).
//
// Igual que en la ruta de auth: el objeto de opciones de createFileRoute solo
// trae `server`, asi que el plugin de Start marca la ruta como server-only y la
// poda del arbol de rutas del cliente. Nada de esto llega al navegador.
//
// El middleware global (src/server/osAuthMiddleware.ts) deja pasar todo /api/
// sin cookie de sesion a proposito: cada endpoint valida su propia auth. Aca
// esa auth es el token maestro OS_API_TOKEN o una key con nombre de
// OS_API_TOKENS, exactamente como en Astro.
//
// El protocolo JSON-RPC lo sigue resolviendo src/mcp/engine.ts sin cambios, y
// la traduccion herramienta -> request de la API vive en src/mcp/osTools.ts
// (extraida del archivo de Astro para no mantener dos copias mientras los dos
// endpoints conviven).

import { createFileRoute } from '@tanstack/react-router';
import { handleMcpStatelessRequest, type McpJsonRpcRequest } from '../../mcp/engine.ts';
import { executeOsTool } from '../../mcp/osTools.ts';
import { esTokenValido, nombrePorToken } from '../../lib/osTokens.ts';
import { readEnv } from '../../lib/env.ts';

// Algunos clientes MCP (Hermes incluido) mandan un preflight OPTIONS antes
// del POST real, como haria un fetch() de navegador con CORS. Sin un handler
// propio, TanStack no encuentra metodo y cae al router de paginas, que
// devuelve el HTML completo del SPA con Content-Type text/html -- el cliente
// MCP lo rechaza pensando que la URL apunta a una pagina, no a un endpoint.
// Bug real encontrado por Hermes (perfiles braintech/rafik), no hipotetico.
const corsHeaders = {
  'Access-Control-Allow-Origin': readEnv('OS_PUBLIC_URL') || '',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OS-Token, Mcp-Method, Mcp-Name',
};

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
        const tokenHeader = request.headers.get('X-OS-Token') || request.headers.get('Authorization')?.replace('Bearer ', '');
        const expectedToken = readEnv('OS_API_TOKEN');
        const listaTokens = readEnv('OS_API_TOKENS');

        // Validacion de seguridad de la peticion stateless: token maestro o key
        // con nombre por cliente (OS_API_TOKENS).
        if (!expectedToken || !esTokenValido(tokenHeader, expectedToken, listaTokens)) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Unauthorized: Invalid or missing X-OS-Token / Bearer token.' },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Si el token que llego es una key con nombre (no el maestro), su
        // nombre se propaga a executeOsTool para que firme el evento con su
        // propia identidad en vez de con "hermes" (ver identidadCliente en
        // src/server/osAuth.ts). Con el token maestro, actorNombrado queda
        // null y executeOsTool no manda el header interno.
        const actorNombrado = tokenHeader === expectedToken ? null : nombrePorToken(listaTokens, tokenHeader);

        try {
          const rawBody = await request.json();
          const responsePayload = await handleMcpStatelessRequest(
            rawBody as McpJsonRpcRequest,
            request.headers,
            (name, args) => executeOsTool(request, name, args, actorNombrado),
          );

          return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'Mcp-Version': '2026-07-28',
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32700, message: `Parse error: ${err instanceof Error ? err.message : String(err)}` },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      },
    },
  },
});
