// Server route de login/logout, portado de src/pages/api/os-auth.ts (Astro).
//
// El objeto de opciones de createFileRoute solo trae `server`: eso marca la
// ruta como server-only y el plugin de Start la poda del arbol de rutas del
// cliente, asi que nada de esto llega al bundle del navegador.

import { createFileRoute } from '@tanstack/react-router';
import { readEnv } from '../../lib/env.ts';
import { cookieSesionOs, cookieSesionOsBorrada } from '../../server/osAuth.ts';

function redirigir(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

// Destino post-login. Solo se acepta una ruta relativa del propio OS (empieza
// con '/' y no con '//' ni '/\', que abrirían un redirect a otro host). Sirve
// para que el flujo OAuth (/api/oauth/authorize) vuelva a su lugar despues de
// que Pancho se loguea. Ante cualquier cosa rara, cae a '/'.
function destinoSeguro(next: unknown): string {
  if (typeof next !== 'string' || !next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

export const Route = createFileRoute('/api/os-auth')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = await request.formData();
        const password = data.get('password');
        const next = destinoSeguro(data.get('next'));
        const expectedPassword = readEnv('OS_PASSWORD');
        const token = readEnv('OS_AUTH_TOKEN');

        // Sin defaults hardcodeados: un OS_PASSWORD/OS_AUTH_TOKEN sin configurar
        // debe fallar fuerte, no caer a una contrasena conocida en el codigo
        // fuente.
        if (!expectedPassword || !token) {
          return new Response('OS_PASSWORD / OS_AUTH_TOKEN no configurados en el servidor.', {
            status: 500,
          });
        }

        if (password === expectedPassword) {
          return redirigir(next, cookieSesionOs(token));
        }

        // Se conserva el next en el reintento para no perder el destino OAuth.
        const errorUrl = next === '/' ? '/login?error=1' : `/login?error=1&next=${encodeURIComponent(next)}`;
        return redirigir(errorUrl);
      },

      GET: ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('action') === 'logout') {
          return redirigir('/login', cookieSesionOsBorrada());
        }
        return redirigir('/login');
      },
    },
  },
});
