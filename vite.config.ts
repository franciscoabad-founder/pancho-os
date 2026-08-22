import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

// Migracion Astro -> TanStack Start, ver plan en
// C:\Users\Francisco\.claude-rafik\plans\ok-entonces-lo-que-sharded-petal.md

// Assets del build intermedio de Vite para los servicios de Nitro, es decir
// node_modules/.nitro/vite/services/<servicio>/assets/*.js. El entry del
// servicio (index.js) queda deliberadamente FUERA de este match.
const NITRO_SERVICE_ASSET_RE =
  /[\\/]\.nitro[\\/]vite[\\/]services[\\/][^\\/]+[\\/]assets[\\/]/;

// Por que existe este grupo de code splitting (regresion de fase 1.2.8):
//
// El build de Nitro corre en dos pasadas. Primero Vite emite el servicio SSR en
// node_modules/.nitro/vite/services/ssr/ (index.js mas assets/*.js), y despues
// Rolldown re-empaqueta esos archivos hacia .output/server.
//
// En la segunda pasada Nitro nombra los chunks con getChunkName(), que manda
// todo lo que viva bajo "vite/services" al patron `_ssr/[name].mjs`. El entry
// del servicio se llama "ssr", asi que aterriza en _ssr/ssr.mjs, que es
// exactamente el archivo que carga el runtime:
//
//   .output/server/_chunks/ssr-renderer.mjs
//   lazyService(() => import("../_ssr/ssr.mjs").then((n) => n.a))
//
// donde `n.a` es el objeto namespace del entry (`ssr_exports`).
//
// El conflicto: createCsrfMiddleware termina siendo un chunk COMPARTIDO entre
// el entry del servicio y el chunk de src/start.ts, porque los dos lo importan
// (ver el comentario de src/start.ts sobre por que hay que re-registrar el CSRF
// a mano: declarar `requestMiddleware` reemplaza entero el default del
// framework). Pasado cierto tamano del grafo, Rolldown le asigna a ese chunk
// compartido el mismo nombre base que al entry ("ssr"). Los dos piden entonces
// el archivo _ssr/ssr.mjs y el desempate se lo lleva el compartido: el entry
// real se va a _ssr/ssr2.mjs. El runtime sigue importando _ssr/ssr.mjs, donde
// Rolldown dejo `export { ssr_exports as a, ... }` sin definir jamas
// ssr_exports, y toda request muere con:
//
//   SyntaxError: Export 'ssr_exports' is not defined in module
//
// Fix: cada asset del build de Vite es su propio grupo, nombrado por su propio
// archivo (que ya trae hash de Vite). Asi ningun chunk compartido puede robarle
// el nombre "ssr" al entry, y se conserva el code splitting por ruta, un chunk
// por asset, igual que en los builds sanos previos a la regresion.
//
// includeDependenciesRecursively en false es obligatorio aca. Con el default
// (true) el grupo se traga tambien las dependencias del asset, y como las rutas
// dependen del router y el router del entry, TODO el servicio terminaba
// absorbido dentro del chunk de la primera ruta (probado: el entry aparecia
// dentro de _ssr/login-*.mjs y se perdia el lazy loading de rutas). Cada grupo
// aca cubre exactamente un modulo, que es justo el reparto que Vite ya decidio
// en la primera pasada, asi que no hay nada que incluir recursivamente. El
// riesgo que documenta Rolldown al desactivarlo son los chunks circulares: se
// verifico que el grafo estatico de .output/server queda sin ciclos.
const nitroServiceAssetChunks = {
  test: NITRO_SERVICE_ASSET_RE,
  name: (id: string) =>
    id.split(/[\\/]/).pop()?.replace(/\.[cm]?jsx?$/, '') ?? null,
  includeDependenciesRecursively: false,
};

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Con 2+ islas React en una pagina, Vite puede resolver React por dos
    // rutas y el SSR lanza "Invalid hook call" (visto en produccion con
    // Astro en /). Forzar una sola copia de react/react-dom en el grafo.
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // `rolldownConfig` y no `rollupConfig`: el bundler real de la segunda
      // pasada es Rolldown (nitro/dist/_build/rolldown.mjs) y es la unica de
      // las dos claves tipada con el OutputOptions de Rolldown, que es donde
      // vive `codeSplitting`. Nitro hace defu de las dos, asi que conviven.
      rolldownConfig: {
        output: { codeSplitting: { groups: [nitroServiceAssetChunks] } },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
