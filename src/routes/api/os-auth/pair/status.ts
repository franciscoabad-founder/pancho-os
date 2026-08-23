// GET /api/os-auth/pair/status?device_id=X -- lo pollea el dispositivo nuevo.
// PUBLICO A PROPOSITO, misma razon que pair/start: el que pregunta todavia no
// tiene token, justamente lo esta esperando.
//
// Tres respuestas posibles:
//   200 { status: 'pending' }                    -> Pancho todavia no confirmo
//   200 { status: 'confirmed', token: '<crudo>' } -> UNA sola vez en la vida
//   404 / 410                                     -> no existe, vencio, o ya se entrego
//
// La entrega unica es el punto entero de este endpoint: quien conozca el
// device_id despues de que el dispositivo legitimo se llevo el token no puede
// volver a pedirlo (delivered_at). El detalle de como se marca esta en
// src/server/devices.handlers.ts.

import { createFileRoute } from '@tanstack/react-router';
import { json } from '../../../../server/osAuth.ts';
import { ErrorDispositivos, consultarPairing } from '../../../../server/devices.handlers.ts';

// Mismo criterio que pair/start: endpoint publico, asi que el detalle interno
// de la base no sale. Los ErrorDispositivos si, que son los que le dicen al
// dispositivo si tiene que seguir esperando o repetir el pairing.
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorDispositivos) return json({ error: err.message }, err.status);
  return json({ error: 'no se pudo consultar el emparejamiento' }, 502);
}

export const Route = createFileRoute('/api/os-auth/pair/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const deviceId = new URL(request.url).searchParams.get('device_id');
          const estado = await consultarPairing(deviceId);
          // Cache-Control explicito: esta respuesta trae un secreto de un solo
          // uso, ningun intermediario tiene por que guardarla.
          return new Response(JSON.stringify(estado), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
