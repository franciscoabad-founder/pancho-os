// Alias de compatibilidad: Hoy vive en la home `/`, pero enlaces antiguos y
// accesos directos pueden seguir apuntando a `/hoy`.
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/hoy')({
  beforeLoad: () => {
    throw redirect({ to: '/', statusCode: 301 });
  },
  component: () => null,
});
