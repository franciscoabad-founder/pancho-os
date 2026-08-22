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
import { esTokenValido } from '../../lib/osTokens.ts';
import { readEnv } from '../../lib/contenido/radar/env.ts';

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
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

        try {
          const rawBody = await request.json();
          const responsePayload = await handleMcpStatelessRequest(
            rawBody as McpJsonRpcRequest,
            request.headers,
            (name, args) => executeOsTool(request, name, args),
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
