// Middleware global de request, portado de src/middleware.ts (Astro).
//
// En TanStack Start no hay `defineMiddleware` + `onRequest`: se crea un
// middleware de tipo 'request' y se registra en la instancia de start
// (src/start.ts, `createStart({ requestMiddleware: [...] })`). El middleware
// corre para TODO lo que atiende el handler de Start: paginas, server routes y
// server functions. Devolver un Response corta la cadena; `next()` sigue.
//
// Este archivo es solo la cascara: la decision de acceso vive en
// ./osAuthPolicy.ts, que no importa framework y por eso se testea con
// `node --test` (src/server/osAuthPolicy.test.ts, `npm run test:auth`).

import { createMiddleware } from '@tanstack/react-start';
import { decidirAccesoOs } from './osAuthPolicy.ts';
import { respuestaMetadataOauth } from './oauthMetadata.ts';

// Assets internos del dev server de Vite (/@vite/client, /@fs/..., /src/...) y
// la puerta de QA local (las paginas /qa-* no se commitean). En produccion
// Nitro sirve los estaticos antes de llegar al handler de Start, asi que esto
// solo hace falta en dev.
//
// Va aca y no en osAuthPolicy.ts a proposito: al quedar dentro del `if
// (import.meta.env.DEV)`, Vite lo evalua como `false` en el build y el bundler
// borra la rama entera. En produccion el bypass no existe ni como dato muerto,
// igual que el `import.meta.env.DEV` del middleware de Astro.
const DEV_PREFIXES = ['/@', '/src/', '/node_modules/', '/qa-'];

export const osAuthRequestMiddleware = createMiddleware({ type: 'request' }).server(
  ({ request, pathname, handlerType, next }) => {
    if (import.meta.env.DEV && DEV_PREFIXES.some((p) => pathname.startsWith(p))) {
      return next();
    }

    // Documentos de descubrimiento OAuth. Se sirven desde aca para no depender
    // de como Nitro trate el static serving de public/.well-known (dotfiles).
    // En produccion, si Nitro ya los sirvio como estaticos, esta rama ni corre
    // (los estaticos se resuelven antes del handler de Start); en dev y como
    // respaldo, responde el mismo JSON. Ver src/server/oauthMetadata.ts.
    const metadata = respuestaMetadataOauth(pathname);
    if (metadata) return metadata;

    return decidirAccesoOs({ pathname, request, handlerType }) ?? next();
  },
);
