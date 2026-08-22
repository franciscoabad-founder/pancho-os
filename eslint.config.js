// @ts-check

// Fronteras de los organos del OS.
//
// Un organo (src/organs/<nombre>/) tiene tres capas y una sola puerta:
//
//   domain/   reglas de negocio en TypeScript puro
//   server/   Supabase y endpoints
//   ui/       componentes React
//   index.ts  <- la unica superficie importable desde afuera del organo
//
// Sin enforcement esto es una carpeta bonita que se degrada en la primera
// semana: alguien importa `../../organs/contenido/server/x.ts` porque le queda
// a mano y la modularidad se muere en silencio. Esta regla lo convierte en un
// error de lint.
//
// Lo que bloquea: cualquier import de `server/` o de `ui/` de un organo hecho
// desde fuera de ese organo. Da igual si es relativo (`../../organs/...`) o por
// el alias `#/organs/...` de package.json/tsconfig: los dos patrones estan
// cubiertos.
//
// Las dos excepciones, ambas deliberadas:
//
//   1. src/organs/<nombre>/**  -> adentro del organo se importa libre entre sus
//      propias capas. La frontera es hacia afuera, no interna.
//   2. src/routes/**  -> es el punto de montaje HTTP del OS y el router de
//      TanStack Start es basado en archivos: las server routes SOLO son
//      descubiertas bajo src/routes, no pueden vivir dentro del organo. Ese
//      arbol es la raiz de composicion (monta server/ en src/routes/api/*.ts y
//      ui/ en las paginas). Todo lo demas (otro organo, src/lib, src/server,
//      src/os, src/mcp) entra por src/organs/<nombre>/index.ts.
//
// Se corre con `npm run lint` (eslint + typescript-eslint quedaron declarados
// en devDependencies como parte de este paso).

import tseslint from 'typescript-eslint';

const MENSAJE_FRONTERA = [
  'Frontera de organo: server/ y ui/ son privados del organo.',
  'Importa desde src/organs/<organo>/index.ts (que expone solo domain/).',
  'Unica excepcion: src/routes/**, la raiz de composicion HTTP del OS.',
].join(' ');

const PATRONES_ORGANO = [
  {
    group: [
      '**/organs/*/server',
      '**/organs/*/server/**',
      '**/organs/*/ui',
      '**/organs/*/ui/**',
      '#/organs/*/server',
      '#/organs/*/server/**',
      '#/organs/*/ui',
      '#/organs/*/ui/**',
    ],
    message: MENSAJE_FRONTERA,
  },
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.output/**',
      '.tanstack/**',
      '.astro/**',
      'src/routeTree.gen.ts',
      'eslint.config.js',
    ],
  },

  // Regla base: aplica a todo el codigo fuente del OS.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // noInlineConfig cumple dos funciones aca. La practica: el arbol trae
    // comentarios `eslint-disable-next-line react-hooks/exhaustive-deps` de la
    // epoca Astro, de un plugin que este repo no instala, y sin esto cada uno
    // revienta con "Definition for rule was not found". La de fondo, que es la
    // que importa: una frontera de arquitectura que se puede apagar con un
    // comentario en la linea de arriba no es una frontera. Este config existe
    // para eso, no para ser configurable archivo por archivo.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-restricted-imports': ['error', { patterns: PATRONES_ORGANO }],
    },
  },

  // Excepcion 1: adentro del propio organo.
  {
    files: ['src/organs/**/*.ts', 'src/organs/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Excepcion 2: la raiz de composicion (server routes y paginas).
  {
    files: ['src/routes/**/*.ts', 'src/routes/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
