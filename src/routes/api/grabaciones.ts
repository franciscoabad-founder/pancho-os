// Server route de /api/grabaciones, portada de src/pages/api/grabaciones.ts (Astro).
//
// CAMBIO DE INFRAESTRUCTURA (documentado tambien en
// src/server/grabaciones.handlers.ts): la version Astro subia el audio a
// Supabase Storage con createSignedUploadUrl y lo entregaba a n8n con
// createSignedUrl. Supabase Storage ya no existe en este stack (la base es
// Postgres autoalojado detras de PostgREST), asi que el audio pasa a guardarse
// en el disco del servidor, bajo OS_GRABACIONES_DIR (default ./data/grabaciones).
//
// El contrato con OSGrabar se conserva entero, por eso el componente no cambia:
//
//   POST { action: 'start', mime }  ->  { ok, path, uploadUrl, mime }
//   PUT  <uploadUrl> con el Blob    ->  { ok, path }
//   POST { action: 'done', path, titulo, proyecto, duracion, mime } -> { ok }
//
// Lo unico que cambia es que `uploadUrl` es ahora esta misma route
// (/api/grabaciones?path=...) en vez de una URL de Supabase, y que la respuesta
// de start ya no incluye `token` (era el token de subida de Supabase; OSGrabar
// nunca lo leyo).
//
// GET sirve el audio de vuelta. Acepta dos credenciales: la sesion normal del
// OS (isOsAuthorized) o una firma HMAC de 7 dias en el query string, que es la
// que se le manda a n8n y el equivalente local de createSignedUrl.

import { createFileRoute } from '@tanstack/react-router';
import { readEnv } from '../../lib/env.ts';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  firmaDescargaValida,
  guardarGrabacion,
  leerGrabacion,
  normalizarProyecto,
  notificarTranscripcion,
  nuevaRutaGrabacion,
  queryDescargaFirmado,
  rutaAbsoluta,
} from '../../server/grabaciones.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// Base publica para la URL que consume n8n. En produccion detras de Caddy el
// esquema que reconstruye Nitro puede ser http, por eso OS_PUBLIC_URL manda si
// esta puesto; sin ella se cae al origen de la propia request.
function origenPublico(request: Request): string {
  const configurado = readEnv('OS_PUBLIC_URL');
  return (configurado || new URL(request.url).origin).replace(/\/$/, '');
}

async function manejarStart(body: Record<string, unknown>): Promise<Response> {
  try {
    const { path, mime } = nuevaRutaGrabacion(String(body.mime ?? 'audio/webm'));
    const uploadUrl = `/api/grabaciones?path=${encodeURIComponent(path)}`;
    return json({ ok: true, path, uploadUrl, mime });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
}

async function manejarDone(body: Record<string, unknown>, request: Request): Promise<Response> {
  const path = String(body.path ?? '');
  try {
    rutaAbsoluta(path);
  } catch {
    return json({ error: 'Path invalido' }, 400);
  }

  const proyecto = normalizarProyecto(body.proyecto);
  const titulo = String(body.titulo ?? '').trim().slice(0, 160);
  const duracion = Math.max(0, Math.round(Number(body.duracion ?? 0)));
  const mime = String(body.mime ?? 'audio/webm');

  let audioUrl: string;
  try {
    audioUrl = `${origenPublico(request)}/api/grabaciones?${queryDescargaFirmado(path)}`;
  } catch (err) {
    return json({ error: `No se pudo firmar la descarga: ${String(err)}` }, 502);
  }

  try {
    await notificarTranscripcion({ audioUrl, path, titulo, proyecto, duracion, mime });
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'N8N_TRANSCRIBE_URL no configurado') return json({ error: msg }, 500);
    return json({ error: `No se pudo notificar a n8n: ${msg}` }, 502);
  }
}

export const Route = createFileRoute('/api/grabaciones')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        const action = String(body.action ?? '');
        if (action === 'start') return manejarStart(body);
        if (action === 'done') return manejarDone(body, request);
        return json({ error: 'action debe ser start o done' }, 400);
      },

      // Subida del audio. Reemplaza el PUT que antes iba directo a Supabase.
      PUT: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        const path = new URL(request.url).searchParams.get('path') ?? '';
        try {
          rutaAbsoluta(path);
        } catch {
          return json({ error: 'Path invalido' }, 400);
        }

        try {
          const datos = new Uint8Array(await request.arrayBuffer());
          if (datos.byteLength === 0) return json({ error: 'Cuerpo vacio' }, 400);
          await guardarGrabacion(path, datos);
          return json({ ok: true, path });
        } catch (err) {
          return json({ error: `No se pudo guardar el audio: ${String(err)}` }, 502);
        }
      },

      // Descarga. La usa n8n con la firma del query string, y tambien sirve para
      // reproducir una grabacion ya subida desde una sesion del OS.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get('path') ?? '';

        const firmada = firmaDescargaValida(path, url.searchParams.get('exp'), url.searchParams.get('sig'));
        if (!firmada && !(await isOsAuthorized(request))) return noAutorizado();

        try {
          rutaAbsoluta(path);
        } catch {
          return json({ error: 'Path invalido' }, 400);
        }

        try {
          const { datos, mime } = await leerGrabacion(path);
          return new Response(datos, {
            headers: {
              'Content-Type': mime,
              'Content-Length': String(datos.byteLength),
              'Cache-Control': 'private, no-store',
            },
          });
        } catch {
          return json({ error: 'Grabacion no encontrada' }, 404);
        }
      },
    },
  },
});
