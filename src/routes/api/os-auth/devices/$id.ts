// DELETE /api/os-auth/devices/:id -- CON AUTH. Revoca un dispositivo.
//
// No borra la fila: setea revoked_at. La auditoria de que ese dispositivo
// existio, cuando se emparejo y cuando se lo saco vale mas que el espacio de
// una fila. isOsAuthorized() solo mira los que tienen revoked_at is null, asi
// que la revocacion es inmediata: la proxima request de ese token ya no entra.
//
// El id va en la URL y no en query string porque es una identidad, no un
// filtro. Es la primera ruta con parametro del arbol de TanStack Start en este
// repo (`$id` es la convencion de archivo).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json, origenPermitido } from '../../../../server/osAuth.ts';
import { ErrorDispositivos, revocarDispositivo } from '../../../../server/devices.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function respuestaError(err: unknown): Response {
  if (err instanceof ErrorDispositivos) return json({ error: err.message }, err.status);
  // El fallback al `message` de un objeto pelado no es defensivo de mas: los
  // errores de Supabase llegan como objetos planos, no como Error, y sin esto
  // cada fallo real de la base se leeria como 'error desconocido'.
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

export const Route = createFileRoute('/api/os-auth/devices/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        // Misma razon que en pair/confirm: muta estado con la cookie de sesion
        // y el CSRF middleware no cubre /api/**. Aca la consecuencia de una
        // request cruzada seria dejar a Pancho sin sus dispositivos.
        if (!origenPermitido(request)) return json({ error: 'origen no permitido' }, 403);
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json({ ok: true, device: await revocarDispositivo(params.id) });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
