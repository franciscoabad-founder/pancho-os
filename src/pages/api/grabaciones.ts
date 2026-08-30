export const prerender = false;

// Ruta heredada de os.franciscoabad.com. Conserva el mismo contrato de la
// ruta TanStack para que ambas aplicaciones usen el disco del VPS, no
// Supabase Storage.
import type { APIRoute } from 'astro';
import { readEnv } from '../../lib/env.ts';
import { isOsAuthorized, json } from '../../os/lib/osAuth.ts';
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

function origenPublico(context: Parameters<APIRoute>[0]): string {
  const configurado = readEnv('OS_PUBLIC_URL');
  return (configurado || context.url.origin).replace(/\/$/, '');
}

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  const action = String(body.action ?? '');
  if (action === 'start') {
    try {
      const { path, mime } = nuevaRutaGrabacion(String(body.mime ?? 'audio/webm'));
      return json({ ok: true, path, uploadUrl: `/api/grabaciones?path=${encodeURIComponent(path)}`, mime });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  }

  if (action !== 'done') return json({ error: 'action debe ser start o done' }, 400);

  const path = String(body.path ?? '');
  try {
    rutaAbsoluta(path);
  } catch {
    return json({ error: 'Path invalido' }, 400);
  }

  let audioUrl: string;
  try {
    audioUrl = `${origenPublico(context)}/api/grabaciones?${queryDescargaFirmado(path)}`;
  } catch (err) {
    return json({ error: `No se pudo firmar la descarga: ${String(err)}` }, 502);
  }

  try {
    await notificarTranscripcion({
      audioUrl,
      path,
      titulo: String(body.titulo ?? '').trim().slice(0, 160),
      proyecto: normalizarProyecto(body.proyecto),
      duracion: Math.max(0, Math.round(Number(body.duracion ?? 0))),
      mime: String(body.mime ?? 'audio/webm'),
    });
    return json({ ok: true });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    const sinWebhook = mensaje === 'N8N_TRANSCRIBE_URL no configurado';
    return json({ error: sinWebhook ? mensaje : `No se pudo notificar a n8n: ${mensaje}` }, sinWebhook ? 500 : 502);
  }
};

export const PUT: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const path = context.url.searchParams.get('path') ?? '';
  try {
    rutaAbsoluta(path);
  } catch {
    return json({ error: 'Path invalido' }, 400);
  }

  try {
    const datos = new Uint8Array(await context.request.arrayBuffer());
    if (!datos.byteLength) return json({ error: 'Cuerpo vacio' }, 400);
    await guardarGrabacion(path, datos);
    return json({ ok: true, path });
  } catch (err) {
    return json({ error: `No se pudo guardar el audio: ${String(err)}` }, 502);
  }
};

export const GET: APIRoute = async (context) => {
  const path = context.url.searchParams.get('path') ?? '';
  const firmada = firmaDescargaValida(path, context.url.searchParams.get('exp'), context.url.searchParams.get('sig'));
  if (!firmada && !isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);

  try {
    rutaAbsoluta(path);
  } catch {
    return json({ error: 'Path invalido' }, 400);
  }

  try {
    const { datos, mime } = await leerGrabacion(path);
    return new Response(datos, { headers: { 'Content-Type': mime, 'Content-Length': String(datos.byteLength), 'Cache-Control': 'private, no-store' } });
  } catch {
    return json({ error: 'Grabacion no encontrada' }, 404);
  }
};
