import type { APIContext } from 'astro';

export function isOsAuthorized(context: Pick<APIContext, 'cookies' | 'request'>): boolean {
  const cookieToken = context.cookies.get('os_auth')?.value;
  const sessionToken = import.meta.env.OS_AUTH_TOKEN;
  if (cookieToken && sessionToken && cookieToken === sessionToken) return true;

  const auth = context.request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const externalToken = context.request.headers.get('x-os-token');
  const apiToken = import.meta.env.OS_API_TOKEN ?? sessionToken;
  return !!(apiToken && (bearer === apiToken || externalToken === apiToken));
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
