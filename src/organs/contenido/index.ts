// Contrato publico del organo Contenido.
//
// Un "organo" es un modulo del OS con tres capas y UNA sola puerta:
//
//   domain/  reglas de negocio en TypeScript puro. Cero Supabase, cero React,
//            cero framework. Es lo unico que sale de aca.
//   server/  acceso a datos y endpoints HTTP. Habla con Supabase.
//   ui/      componentes React de las pantallas de Contenido.
//   index.ts  <- este archivo: la unica superficie importable desde afuera.
//
// Regla, con enforcement real en eslint.config.js (no solo documentacion):
// nadie fuera de src/organs/contenido/** puede importar de server/ ni de ui/.
// La excepcion declarada es src/routes/**, que es el punto de montaje HTTP del
// OS: ahi viven las server routes que exponen el organo (src/routes/api/*.ts) y
// las paginas que montan sus componentes. Cualquier otro consumidor (otro
// organo, src/lib, src/server, src/os) entra por este index.
//
// Por que solo se re-exporta domain/: es la capa que Nerio va a consumir tal
// cual (plan Fase 3, `@pancho/contenido-core`). Las mismas reglas de negocio,
// con su propio server/ y su propia ui/. Exportar server/ o ui/ desde aca
// arrastraria Supabase y React al paquete y romperia esa reutilizacion.
//
// Nota: esto re-exporta el barril que ya existia (domain/index.ts: types,
// formulas, stages, weekly, verdicts, planner). El sub-modulo domain/radar/**
// queda deliberadamente fuera del barril, igual que antes de la mudanza: tiene
// su propio index con nombres genericos (types, index, SOURCE_KINDS) y meterlo
// aca cambiaria la superficie publica actual. Se importa por ruta explicita
// desde dentro del organo.
export * from './domain/index.ts';
