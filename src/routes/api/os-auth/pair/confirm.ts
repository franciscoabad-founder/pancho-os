// POST /api/os-auth/pair/confirm -- CON AUTH. Es la unica pieza del flujo que
// crea un token, y por eso la unica que exige ser Pancho (o algo que ya tenga
// credencial valida del OS).
//
// Contrato: { code } -> { ok: true, device: { id, label, kind } }.
//
// La respuesta NUNCA trae el token crudo, aunque el que confirma este
// autenticado. El token es del dispositivo que se empareja, no del que aprueba:
// sale una sola vez por pair/status. Asi el secreto no queda en el historial de
// red del navegador de escritorio ni en un log de la UI.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json, origenPermitido } from '../../../../server/osAuth.ts';
import { ErrorDispositivos, confirmarPairing } from '../../../../server/devices.handlers.ts';

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

export const Route = createFileRoute('/api/os-auth/pair/confirm')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // El chequeo de origen va ANTES de la auth: es la unica ruta que acuña
        // una credencial nueva, y el CSRF middleware de src/start.ts no llega
        // hasta aca (solo filtra server functions). Ver origenPermitido().
        if (!origenPermitido(request)) return json({ error: 'origen no permitido' }, 403);
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = (await request.json().catch(() => ({}))) as { code?: unknown };
          const device = await confirmarPairing(body?.code);
          return json({ ok: true, device });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
