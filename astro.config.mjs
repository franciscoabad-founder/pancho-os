import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://os.franciscoabad.com",
  output: "server",
  security: {
    checkOrigin: false,
  },
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    plugins: [tailwindcss()],
    // Con 2+ islas React en una pagina, Vite puede resolver React por dos
    // rutas y el SSR lanza "Invalid hook call" (visto en produccion en /).
    // Forzar una sola copia de react/react-dom en el grafo.
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },
  integrations: [
    react(),
    mdx(),
  ],
});
