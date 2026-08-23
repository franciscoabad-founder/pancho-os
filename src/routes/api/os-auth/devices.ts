// GET /api/os-auth/devices -- CON AUTH. Lo que pinta "Mis dispositivos" en
// /sistema.
//
// Devuelve dos listas distintas a proposito:
//
//   devices     filas reales de os_devices: token hasheado, revocables con un
//               DELETE, con last_seen_at.
//   tokensEnv   las keys con nombre de OS_API_TOKENS (kimi, grok...). SOLO EL
//               NOMBRE, jamas el valor. Son de solo lectura: revocarlas sigue
//               siendo editar el .env del VPS y reiniciar PM2, porque viven en
//               un archivo, no en la base. Estaban 100% invisibles desde la app
//               hasta ahora; que aparezcan aca es la mitad del punto de esta
//               pantalla (saber que credenciales existen), y migrarlas de
//               verdad a os_devices es otra tarea, con rotacion de token
//               incluida y coordinada con cada agente.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { ErrorDispositivos, listarDispositivos } from '../../../server/devices.handlers.ts';
import { parseNombresTokens } from '../../../lib/osTokens.ts';
import { readEnv } from '../../../lib/env.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// A diferencia de las otras rutas de os-auth, aca el error no arma un Response:
// se convierte en texto y viaja dentro de un 200 (ver el comentario del GET).
function mensajeError(err: unknown): string {
  if (err instanceof ErrorDispositivos) return err.message;
  // El fallback al `message` de un objeto pelado no es defensivo de mas: los
  // errores de Supabase llegan como objetos planos, no como Error, y sin esto
  // cada fallo real de la base se leeria como 'error desconocido'.
  return err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
}

export const Route = createFileRoute('/api/os-auth/devices')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        // Los nombres del .env se resuelven aunque Supabase falle: son la parte
        // de la pantalla que no depende de que la migracion este aplicada.
        const tokensEnv = parseNombresTokens(readEnv('OS_API_TOKENS')).map((nombre) => ({
          nombre,
          kind: 'agent' as const,
          origen: 'env' as const,
        }));

        // Degradacion deliberada en vez de 502: si os_devices no existe todavia
        // (migracion 20260823000000 sin aplicar) la pantalla igual tiene algo
        // real que mostrar, que son las keys del .env. Esa mitad no depende de
        // la base y no tiene por que caerse con ella. El error viaja en
        // `devicesError` para que la UI lo muestre como aviso, no como pantalla
        // vacia sin explicacion.
        try {
          return json({ devices: await listarDispositivos(), tokensEnv, devicesError: null });
        } catch (err) {
          return json({ devices: [], tokensEnv, devicesError: mensajeError(err) });
        }
      },
    },
  },
});
