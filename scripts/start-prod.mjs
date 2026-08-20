// Arranque de produccion: carga .env al proceso ANTES de levantar el server.
//
// Astro SSR (adapter node, standalone) no lee .env en runtime por si solo:
// import.meta.env solo se hornea en build para vars referenciadas de forma
// ESTATICA en el codigo (import.meta.env.X literal). Cualquier var leida
// dinamicamente via process.env[name] (como hace src/lib/contenido/radar/env.ts
// a proposito, para funcionar igual en Astro SSR, Node plano y bajo tests)
// se pierde si nadie carga .env al process.env real.
//
// pm2 tampoco relee .env del disco en cada restart: --update-env solo
// refresca desde el entorno de la shell que ejecuta pm2 restart, y aqui pm2
// corre como daemon de systemd sin ese contexto (por eso ademas aparecian
// variables de Hermes filtradas via el entorno del daemon, no las del OS).
//
// Fix: process.loadEnvFile (Node 20.6+) carga el .env real del disco en cada
// arranque del proceso. dist/server/entry.mjs es generado por el build de
// Astro y no se puede editar a mano; este wrapper es lo que arranca pm2 en
// su lugar. Ver deploy.yml y CLAUDE.md.

process.loadEnvFile(new URL('../.env', import.meta.url));

// Este VPS tiene IPv6 con ping funcional pero el handshake HTTPS por esa via
// se cuelga contra Cloudflare (SerpAPI, YouTube): fetch() nativo tardaba
// ~7.2s por request (Node intenta IPv6 primero, agota happy-eyeballs, cae a
// IPv4) contra 165ms forzando IPv4 de entrada. Afecta a toda llamada saliente
// del server (radar, futuras integraciones), por eso vive aqui y no en cada
// adapter. Verificado en vivo el 20 ago 2026: 7199ms -> 165ms.
const { setDefaultResultOrder } = await import('node:dns');
setDefaultResultOrder('ipv4first');

await import('../dist/server/entry.mjs');
