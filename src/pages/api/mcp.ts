import type { APIRoute } from 'astro';
import { handleMcpStatelessRequest, type McpJsonRpcRequest } from '../../mcp/engine.ts';
import { executeOsTool } from '../../mcp/osTools.ts';
import { esTokenValido } from '../../lib/osTokens.ts';

// El allowlist de modulos, toToolRequest y executeOsTool se movieron a
// src/mcp/osTools.ts al portar este endpoint a TanStack Start
// (src/routes/api/mcp.ts). La logica es la misma, solo dejo de estar duplicada
// mientras los dos endpoints conviven durante la migracion. Se re-exporta
// toToolRequest porque los tests de contrato (src/mcp/contrato.test.ts) lo
// importan desde aca.
export { toToolRequest } from '../../mcp/osTools.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const tokenHeader = request.headers.get('X-OS-Token') || request.headers.get('Authorization')?.replace('Bearer ', '');
  const expectedToken = import.meta.env.OS_API_TOKEN || process.env.OS_API_TOKEN;
  const listaTokens = import.meta.env.OS_API_TOKENS || process.env.OS_API_TOKENS;

  // Validación de seguridad de la petición stateless: token maestro o key con
  // nombre por cliente (OS_API_TOKENS).
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
};
