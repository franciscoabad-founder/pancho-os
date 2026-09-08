// /api/hermes/eventos — buzon de eventos que Hermes le empuja al OS (F4).
//
// POST   -> lo llama HERMES, no el navegador. Por eso NO usa isOsAuthorized:
//           Hermes no tiene cookie ni token del OS. Se autentica con el header
//           x-hermes-secret contra HERMES_WEBHOOK_SECRET (variable que ya vive
//           en el .env de produccion).
// GET    -> lista para la campana del OS (?leido=false). Con isOsAuthorized.
// PATCH  -> marca uno como leido ({ id }). Con isOsAuthorized.
//
// Reglas del POST: cuerpo maximo 64 KB (413 si excede) y comparacion del
// secreto en tiempo constante. timingSafeEqual exige buffers del mismo largo o
// lanza, asi que el largo se compara antes y se sale con el mismo 401: un
// atacante no aprende el largo del secreto por la forma de fallar.

import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'node:crypto';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { readEnv } from '../../../lib/env.ts';
import { listarEventos, marcarLeido, registrarEvento } from '../../../server/hermesEventos.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

/** 64 KB. Un evento es texto y metadatos; nada legitimo se acerca a esto. */
export const MAX_CUERPO_BYTES = 64 * 1024;

/**
 * Comparacion en tiempo constante del secreto del webhook.
 *
 * Sin secreto configurado en el server no hay forma de autenticar a nadie: se
 * rechaza todo, en vez de abrir el endpoint por omision.
 */
function secretoValido(request: Request): boolean {
  const esperado = readEnv('HERMES_WEBHOOK_SECRET') ?? '';
  if (!esperado) return false;
  const recibido = request.headers.get('x-hermes-secret') ?? '';
  const a = Buffer.from(recibido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  // timingSafeEqual lanza con largos distintos; comparar el largo primero no
  // filtra nada util (el largo ya se nota por el tamano del header).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function aError(err: unknown): { texto: string; status: number } {
  const texto = String(err instanceof Error ? err.message : err);
  if (texto.includes('no encontrado')) return { texto, status: 404 };
  if (texto.includes('requerido') || texto.includes('invalido')) return { texto, status: 400 };
  return { texto, status: 500 };
}

export const Route = createFileRoute('/api/hermes/eventos')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!secretoValido(request)) return noAutorizado();

        // Se lee como texto para poder medir el cuerpo real: Content-Length es
        // dato del cliente y puede mentir o no venir.
        const crudo = await request.text();
        if (Buffer.byteLength(crudo, 'utf8') > MAX_CUERPO_BYTES) {
          return json({ error: `Cuerpo demasiado grande (max ${MAX_CUERPO_BYTES} bytes)` }, 413);
        }

        let cuerpo: unknown;
        try {
          cuerpo = JSON.parse(crudo);
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        try {
          return json(await registrarEvento(cuerpo), 201);
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },

      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const params = new URL(request.url).searchParams;
        const crudo = params.get('leido');
        const leido = crudo === null || crudo === '' ? undefined : crudo !== 'false';
        try {
          return json({ eventos: await listarEventos({ leido }) });
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let id: unknown;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          id = body.id;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }
        try {
          return json({ evento: await marcarLeido(id) });
        } catch (err) {
          const { texto, status } = aError(err);
          return json({ error: texto }, status);
        }
      },
    },
  },
});
