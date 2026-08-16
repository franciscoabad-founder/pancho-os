import { defineMiddleware } from 'astro:middleware';

// Rutas que no exigen sesion de navegador:
// - /api/*: cada endpoint valida su propia auth (cookie O Bearer/X-OS-Token,
//   que es como entran Hermes y los agentes; el middleware no debe romperlos).
// - /login y estaticos de PWA.
const PUBLIC_PREFIXES = ['/api/', '/_astro/', '/_image'];
const PUBLIC_EXACT = new Set(['/login', '/sw.js', '/manifest.webmanifest', '/os-offline.html', '/favicon.ico', '/favicon.svg']);

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith('/os-icon')) {
    return next();
  }

  // Puerta de QA local: la pagina /qa-* solo existe en dev (no se commitea)
  // y este bypass solo aplica en dev, nunca en el build de produccion.
  if (import.meta.env.DEV && pathname.startsWith('/qa-')) return next();

  const cookie = context.cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (cookie && expected && cookie === expected) return next();

  // Sesion ausente o caducada: al login, en vez de renderizar la pagina con
  // cada modulo escupiendo "Unauthorized" en rojo.
  return context.redirect('/login');
});
