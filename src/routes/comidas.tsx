// Redirect 301 de /comidas a /salud/nutricion, portado de
// src/pages/comidas.astro.
//
// El módulo de Comidas fue absorbido por Salud OS. La bitácora vive ahora en
// Nutrición. Se conserva la ruta (y el 301) porque hay enlaces viejos y atajos
// del telefono apuntando a /comidas.

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/comidas')({
  beforeLoad: () => {
    throw redirect({ to: '/salud/nutricion', statusCode: 301 });
  },
});
