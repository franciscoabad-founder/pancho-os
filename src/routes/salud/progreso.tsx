// Redirect 301 de /salud/progreso a /gfit?tab=progreso, portado de
// src/pages/salud/progreso.astro.
//
// Bug activo confirmado (auditoria 22-ago-2026): esta pagina leia
// sesiones -> sets_log, pero el reproductor GFIT (la fuente real de
// entrenamiento) escribe cada set en gfit_sesion_series, nunca en
// sets_log. Cualquiera que entrene con GFIT veia esta pantalla vacia.
// OSGfitProgreso (en /gfit) es la fuente de verdad correcta.
//
// Va en beforeLoad y no en loader: beforeLoad corre antes de resolver datos y
// antes de montar el componente, asi que el 301 sale sin que el navegador pague
// un render intermedio. Por eso la ruta no declara `component`.
//
// `href` y no `to`: /gfit sigue viviendo en el arbol de Astro (src/pages/gfit.astro)
// y por lo tanto no existe como ruta tipada de TanStack. href manda el destino
// crudo, que es justo lo que hacia Astro.redirect().

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/salud/progreso')({
  beforeLoad: () => {
    throw redirect({ href: '/gfit?tab=progreso', statusCode: 301 });
  },
});
