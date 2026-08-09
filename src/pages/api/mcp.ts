import type { APIRoute } from 'astro';
import { handleMcpStatelessRequest, type McpJsonRpcRequest } from '../../mcp/engine';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const tokenHeader = request.headers.get('X-OS-Token') || request.headers.get('Authorization')?.replace('Bearer ', '');
  const expectedToken = import.meta.env.OS_API_TOKEN || process.env.OS_API_TOKEN;

  // Validación de seguridad de la petición stateless
  if (expectedToken && tokenHeader !== expectedToken) {
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
    const responsePayload = await handleMcpStatelessRequest(rawBody as McpJsonRpcRequest, request.headers);

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
