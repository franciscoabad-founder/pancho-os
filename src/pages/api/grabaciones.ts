export const prerender = false;

// Grabaciones de voz del OS. El audio NUNCA pasa por Vercel (limite ~4.5MB):
// - action=start: crea una signed upload URL de Supabase Storage (bucket privado
//   "grabaciones") y el cliente sube el Blob directo con PUT.
// - action=done: genera una signed download URL de larga duracion y dispara el
//   webhook de n8n (N8N_TRANSCRIBE_URL) que transcribe y guarda en el cerebro.
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

const BUCKET = 'grabaciones';
const PROYECTOS = ['braintech', 'rafik', 'cortex', 'taskr', 'arazza', 'codeis', 'marca', 'personal', 'otros'];
// 7 dias: n8n descarga el audio en minutos, pero el margen permite reintentos.
const DOWNLOAD_TTL_S = 60 * 60 * 24 * 7;

const EXT_POR_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  const action = String(body.action ?? '');

  if (action === 'start') {
    const mimeRaw = String(body.mime ?? 'audio/webm').split(';')[0].trim().toLowerCase();
    const ext = EXT_POR_MIME[mimeRaw];
    if (!ext) return json({ error: `Tipo de audio no soportado: ${mimeRaw}` }, 400);

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `reuniones/${yyyy}/${mm}/reunion-${now.toISOString().slice(0, 10)}-${now.getTime()}-${rand}.${ext}`;

    try {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? 'sin data');
      return json({ ok: true, path, uploadUrl: data.signedUrl, token: data.token, mime: mimeRaw });
    } catch (err) {
      return json({ error: `No se pudo crear la URL de subida: ${String(err)}` }, 502);
    }
  }

  if (action === 'done') {
    const path = String(body.path ?? '');
    if (!path.startsWith('reuniones/') || path.includes('..')) {
      return json({ error: 'Path invalido' }, 400);
    }
    const proyectoRaw = String(body.proyecto ?? 'otros').toLowerCase();
    const proyecto = PROYECTOS.includes(proyectoRaw) ? proyectoRaw : 'otros';
    const titulo = String(body.titulo ?? '').trim().slice(0, 160);
    const duracion = Math.max(0, Math.round(Number(body.duracion ?? 0)));

    const webhook = import.meta.env.N8N_TRANSCRIBE_URL;
    if (!webhook) return json({ error: 'N8N_TRANSCRIBE_URL no configurado' }, 500);

    let audioUrl: string;
    try {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, DOWNLOAD_TTL_S);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'sin signedUrl');
      audioUrl = data.signedUrl;
    } catch (err) {
      return json({ error: `No se pudo firmar la descarga: ${String(err)}` }, 502);
    }

    const osToken = import.meta.env.OS_API_TOKEN ?? import.meta.env.OS_AUTH_TOKEN;
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(osToken ? { 'X-OS-Token': osToken } : {}),
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          path,
          titulo,
          proyecto,
          duracion_s: duracion,
          mime: String(body.mime ?? 'audio/webm'),
          fecha: new Date().toISOString(),
          source: 'os-grabar',
        }),
      });
      if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
      return json({ ok: true });
    } catch (err) {
      return json({ error: `No se pudo notificar a n8n: ${String(err)}` }, 502);
    }
  }

  return json({ error: 'action debe ser start o done' }, 400);
};
