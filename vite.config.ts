import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

// Migracion Astro -> TanStack Start, ver plan en
// C:\Users\Francisco\.claude-rafik\plans\ok-entonces-lo-que-sharded-petal.md
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
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
