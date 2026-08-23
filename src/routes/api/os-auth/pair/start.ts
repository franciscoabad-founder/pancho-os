// POST /api/os-auth/pair/start -- arranca un pairing. PUBLICO A PROPOSITO.
//
// Lo llama el dispositivo nuevo, que por definicion todavia no tiene con que
// autenticarse. Lo unico que consigue quien lo llame sin permiso es crear una
// fila pendiente y un codigo de 6 digitos que no vale nada por si solo: sin el
// pair/confirm de Pancho (que SI exige sesion) nunca nace un token.
//
// Lo mismo lo llama la UI de /sistema cuando Pancho genera un codigo desde el
// escritorio: ahi el QR lleva la URL /pair/<device_id>, y el telefono que lo
// escanea hereda el device_id sin necesidad de llamar el mismo a este endpoint.
//
// Contrato: { kind, label? } -> { device_id, code, expires_at }.
// Ojo con el nombre: `device_id` es el id de la SOLICITUD (os_pairing_requests),
// no el de os_devices, que recien existe al confirmar. Se llama asi porque es lo
// que el dispositivo guarda y despues pollea en pair/status.
//
// Al ser publico y escribir en la base, es el endpoint con mas superficie de
// abuso del OS. Los tres frenos (limite por cliente, tope global de solicitudes
// vivas, purga de vencidas) viven en devices.handlers.ts; aca solo se resuelve
// de quien es la request.

import { createFileRoute } from '@tanstack/react-router';
import { claveClienteRequest, json } from '../../../../server/osAuth.ts';
import { ErrorDispositivos, iniciarPairing } from '../../../../server/devices.handlers.ts';

// A diferencia de los endpoints con sesion, aca el mensaje crudo del error NO
// vuelve al cliente: cualquiera en internet puede llamar este endpoint, y los
// errores de Supabase nombran tablas, columnas y constraints. Los errores de
// negocio (ErrorDispositivos) si viajan enteros porque son mensajes escritos
// para que el que empareja entienda que hacer.
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorDispositivos) return json({ error: err.message }, err.status);
  return json({ error: 'no se pudo iniciar el emparejamiento' }, 502);
}

export const Route = createFileRoute('/api/os-auth/pair/start')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Un cuerpo vacio o roto no es un 502: es un 400 por kind faltante,
          // que es lo que dice iniciarPairing.
          const body = await request.json().catch(() => ({}));
          const solicitud = await iniciarPairing((body ?? {}) as Record<string, unknown>, {
            clienteId: claveClienteRequest(request),
          });
          return json(solicitud, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
