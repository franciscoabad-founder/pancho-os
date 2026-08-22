// Entry de la instancia de Start. El plugin de Vite lo busca por convencion en
// src/start.ts y espera el export `startInstance` (si no existe, usa un entry
// por defecto que exporta `undefined`).
//
// Aca se registra el middleware global de request: el equivalente en TanStack
// Start del `onRequest` de src/middleware.ts en Astro.

import { createCsrfMiddleware, createStart } from '@tanstack/react-start';
import { osAuthRequestMiddleware } from './server/osAuthMiddleware.ts';

// OJO: sin instancia de start, el handler de Start inyecta por su cuenta un
// `defaultCsrfMiddleware` (start-server-core/createStartHandler.js:288 y :21).
// Al declarar `requestMiddleware` ese default se reemplaza entero, asi que hay
// que volver a registrar el CSRF a mano o las server functions quedan
// desprotegidas: SameSite=Lax manda igual la cookie os_auth en una navegacion
// GET top-level, con lo cual una pagina atacante podria disparar un
// /_serverFn/... con la sesion de la victima.
//
// Misma config que el default del framework: solo valida server functions, las
// navegaciones normales de paginas no se tocan.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
});

// El CSRF va primero: cortar una request cruzada antes de mirar la sesion.
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, osAuthRequestMiddleware],
}));
