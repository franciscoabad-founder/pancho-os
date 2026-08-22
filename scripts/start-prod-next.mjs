// Arranque de produccion para el deploy PARALELO de la migracion TanStack
// Start (rama tanstack-migration, proceso PM2 "pancho-os-next", puerto
// 4323). Ver Fase 1.2.0 del plan:
// C:\Users\Francisco\.claude-rafik\plans\ok-entonces-lo-que-sharded-petal.md
//
// Mismos dos fixes que scripts/start-prod.mjs (el server viejo de Astro),
// portados tal cual porque son fixes reales de produccion, no artefactos
// de Astro:

// 1) process.loadEnvFile carga el .env real del disco en cada arranque del
// proceso -- pm2 no relee .env solo con --update-env cuando corre como
// daemon de systemd sin contexto de shell.
process.loadEnvFile(new URL('../.env', import.meta.url));

// 2) IPv4-first: el VPS cuelga ~7s por request saliente si intenta IPv6
// primero contra Cloudflare (SerpAPI, YouTube) antes de caer a IPv4.
const { setDefaultResultOrder } = await import('node:dns');
setDefaultResultOrder('ipv4first');

// El preset "node-server" de Nitro (ver .output/nitro.json tras el build)
// lee PORT/HOST del entorno. .env define PORT=4322 para el proceso viejo
// (pancho-os); este proceso paralelo (pancho-os-next) SIEMPRE fuerza 4323,
// sin importar lo que traiga el .env cargado arriba.
process.env.PORT = '4323';
process.env.HOST ??= '0.0.0.0';

await import('../.output/server/index.mjs');
