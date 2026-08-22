// Politica de acceso del middleware global, portada de src/middleware.ts
// (Astro). Vive aparte de osAuthMiddleware.ts a proposito: aca no hay ni un
// import de framework, asi que se puede ejercitar con `node --test` sin
// levantar Vite ni el handler de Start. El test de contrato del middleware que
// pide el paso 1.2.2 del plan es src/server/osAuthPolicy.test.ts.
//
// osAuthMiddleware.ts queda como cascara de 10 lineas que traduce el contexto
// de TanStack Start a esta funcion.

import { tieneSesionOs } from './osAuth.ts';

// Rutas que no exigen sesion de navegador:
// - /api/*: cada endpoint valida su propia auth (cookie O Bearer/X-OS-Token,
//   que es como entran Hermes y los agentes; el middleware no debe romperlos).
// - /login y estaticos de PWA.
export const PUBLIC_PREFIXES = ['/api/'];
export const PUBLIC_EXACT = new Set([
  '/login',
  '/sw.js',
  '/manifest.webmanifest',
  '/os-offline.html',
  '/favicon.ico',
  '/favicon.svg',
]);

// Este modulo no conoce el concepto de "dev": los bypasses del dev server de
// Vite viven en osAuthMiddleware.ts detras de `import.meta.env.DEV`, que Vite
// reemplaza por el literal `false` y el bundler elimina entero del build de
// produccion. Asi el bypass no puede filtrarse ni como dato muerto, y este
// modulo describe SOLO lo que es publico en produccion.

export type TipoHandlerOs = 'serverFn' | 'router' | (string & {});

export function esRutaPublica(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith('/os-icon')) return true;

  return false;
}

export type ContextoAccesoOs = {
  pathname: string;
  request: Request;
  handlerType?: TipoHandlerOs;
};

// Devuelve el Response con el que hay que cortar la cadena, o undefined si la
// request puede seguir (`next()`).
export function decidirAccesoOs(ctx: ContextoAccesoOs): Response | undefined {
  if (esRutaPublica(ctx.pathname)) return undefined;

  if (tieneSesionOs(ctx.request)) return undefined;

  // Las server functions son RPC del navegador: un 302 a /login les llegaria
  // como HTML basura dentro del fetch. Cortamos con 401 y que el cliente
  // decida (el usuario igual va a ver /login en la proxima navegacion).
  if (ctx.handlerType === 'serverFn') {
    return new Response('Unauthorized', { status: 401 });
  }

  // Sesion ausente o caducada: al login, en vez de renderizar la pagina con
  // cada modulo escupiendo "Unauthorized" en rojo.
  return new Response(null, { status: 302, headers: { Location: '/login' } });
}
