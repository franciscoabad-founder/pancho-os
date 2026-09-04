// Almacenamiento de grabaciones de voz del OS en disco local del servidor.
//
// CAMBIO DE INFRAESTRUCTURA respecto de la version Astro
// (src/pages/api/grabaciones.ts): esa version guardaba el audio en Supabase
// Storage (bucket privado "grabaciones") usando createSignedUploadUrl y
// createSignedUrl. Supabase Storage ya no existe en este stack: la base es
// Postgres autoalojado detras de PostgREST, sin servicio de Storage. El audio
// pasa a vivir en el disco del VPS, bajo el directorio de OS_GRABACIONES_DIR
// (por defecto ./data/grabaciones).
//
// Lo que se conserva:
//   - el mismo esquema de rutas: reuniones/YYYY/MM/reunion-<fecha>-<ts>-<rand>.<ext>
//   - los mismos MIME aceptados y el mismo TTL de descarga (7 dias)
//   - el mismo contrato JSON con OSGrabar (action=start devuelve
//     { ok, path, uploadUrl, mime }; action=done devuelve { ok })
//
// Lo que cambia:
//   - `uploadUrl` ya no es una URL firmada de Supabase sino la propia route
//     /api/grabaciones?path=... El cliente sigue haciendo un PUT con el Blob,
//     asi que OSGrabar no necesita cambios.
//   - `token` deja de existir en la respuesta de start: era el token de subida
//     de Supabase y OSGrabar nunca lo usaba.
//   - la URL de descarga que recibe n8n se firma aca con HMAC-SHA256 sobre
//     path + expiracion. Es el equivalente local de createSignedUrl: n8n puede
//     bajar ese audio sin credencial del OS, y solo ese audio, y solo hasta que
//     expire la firma.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { readEnv } from '../lib/env.ts';
import { createGbrainClient } from '../os/lib/gbrain.ts';
import { bindBrainWriteToTenant, createDedupeKey, validateBrainWrite, type BrainWriteClientInput, BRAIN_WRITE_TAGS } from '../lib/brain-write.ts';

export const PROYECTOS = ['braintech', 'rafik', 'cortex', 'taskr', 'arazza', 'codeis', 'marca', 'personal', 'otros'];

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

// Vuelta atras para servir la descarga con el Content-Type correcto. webm gana
// audio/webm porque es lo que graba OSGrabar.
const MIME_POR_EXT: Record<string, string> = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

function directorioBase(): string {
  return resolve(readEnv('OS_GRABACIONES_DIR') ?? './data/grabaciones');
}

/** Secreto de firma. Se reusa el token de sesion del OS: si no hay, no hay firma. */
function secretoFirma(): string {
  const secreto = readEnv('OS_API_TOKEN') ?? readEnv('OS_AUTH_TOKEN');
  if (!secreto) throw new Error('OS_API_TOKEN u OS_AUTH_TOKEN requerido para firmar descargas');
  return secreto;
}

/**
 * Valida una ruta logica y la resuelve a una ruta absoluta dentro del
 * directorio base. Dos barreras, no una: el prefijo `reuniones/` y la
 * comprobacion de que la ruta resuelta sigue estando bajo la base. La segunda
 * es la que de verdad para un `..` codificado o un separador de Windows.
 */
export function rutaAbsoluta(path: string): string {
  if (!path.startsWith('reuniones/') || path.includes('..') || path.includes('\0')) {
    throw new Error('Path invalido');
  }
  const base = directorioBase();
  const abs = resolve(join(base, path));
  if (abs !== base && !abs.startsWith(base + sep)) throw new Error('Path invalido');
  return abs;
}

/** Genera la ruta logica de una grabacion nueva. Lanza si el MIME no se soporta. */
export function nuevaRutaGrabacion(mimeCrudo: string): { path: string; mime: string } {
  const mime = mimeCrudo.split(';')[0].trim().toLowerCase();
  const ext = EXT_POR_MIME[mime];
  if (!ext) throw new Error(`Tipo de audio no soportado: ${mime}`);

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `reuniones/${yyyy}/${mm}/reunion-${now.toISOString().slice(0, 10)}-${now.getTime()}-${rand}.${ext}`;
  return { path, mime };
}

export async function guardarGrabacion(path: string, datos: Uint8Array): Promise<void> {
  const abs = rutaAbsoluta(path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, datos);
}

export async function leerGrabacion(path: string): Promise<{ datos: Buffer; mime: string }> {
  const abs = rutaAbsoluta(path);
  const datos = await readFile(abs);
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return { datos, mime: MIME_POR_EXT[ext] ?? 'application/octet-stream' };
}

// --- Firma de descarga -------------------------------------------------------

function firma(path: string, exp: number): string {
  return createHmac('sha256', secretoFirma()).update(`${path}:${exp}`).digest('hex');
}

/** Equivalente local de createSignedUrl: query string firmado, valido 7 dias. */
export function queryDescargaFirmado(path: string): string {
  const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL_S;
  const params = new URLSearchParams({ path, exp: String(exp), sig: firma(path, exp) });
  return params.toString();
}

/** Verifica la firma de descarga. Comparacion en tiempo constante. */
export function firmaDescargaValida(path: string, expRaw: string | null, sig: string | null): boolean {
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  let esperada: string;
  try {
    esperada = firma(path, exp);
  } catch {
    // Sin secreto configurado no se puede validar nada: se falla cerrado.
    return false;
  }
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Transcripcion y minuta (Groq) + escritura al brain ---------------------
//
// Antes esto lo hacia un webhook de n8n (N8N_TRANSCRIBE_URL) que nunca se
// configuro. Ahora corre dentro del propio proceso del OS: no depende de
// infraestructura externa mas alla de la API de Groq y gbrain.
//   1. Whisper de Groq (whisper-large-v3-turbo) transcribe el audio ya
//      guardado en disco.
//   2. Un modelo de chat de Groq (llama-3.3-70b-versatile) redacta una
//      minuta corta a partir de esa transcripcion.
//   3. La pagina (minuta + transcripcion completa) se escribe a gbrain con
//      el mismo contrato que usa el Diario (src/lib/brain-write.ts).

export interface AvisoTranscripcion {
  path: string;
  titulo: string;
  proyecto: string;
  duracion: number;
  mime: string;
}

const EXT_A_GROQ: Record<string, string> = { webm: 'webm', m4a: 'm4a', mp3: 'mp3', wav: 'wav', ogg: 'ogg' };

async function transcribirConGroq(audio: Buffer, mime: string, nombreArchivo: string): Promise<string> {
  const apiKey = readEnv('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY no configurado');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), nombreArchivo);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq Whisper HTTP ${res.status}: ${await res.text()}`);
  return (await res.text()).trim();
}

async function redactarMinuta(transcript: string, titulo: string, proyecto: string): Promise<string> {
  const apiKey = readEnv('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY no configurado');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Redactas minutas de reunion en espanol, breves y accionables. ' +
            'Estructura fija en Markdown: "## Resumen" (2-4 frases), "## Puntos clave" (bullets), ' +
            '"## Acuerdos y pendientes" (bullets, con responsable si se menciona). ' +
            'No inventes nombres, cifras ni acuerdos que no esten en la transcripcion. ' +
            'Si la transcripcion es muy corta o poco clara, dilo explicitamente en vez de rellenar.',
        },
        {
          role: 'user',
          content: `Titulo: ${titulo || '(sin titulo)'}\nProyecto: ${proyecto}\n\nTranscripcion:\n${transcript}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq chat HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const minuta = data.choices?.[0]?.message?.content?.trim();
  if (!minuta) throw new Error('Groq chat: respuesta sin contenido');
  return minuta;
}

/** Mapea el proyecto de OSGrabar (lista PROYECTOS) a un tag valido de gbrain. */
function tagDeProyecto(proyecto: string): string {
  return (BRAIN_WRITE_TAGS as readonly string[]).includes(proyecto) ? proyecto : 'os';
}

export async function transcribirYGuardarEnBrain(aviso: AvisoTranscripcion): Promise<{ slug: string }> {
  const token = readEnv('GBRAIN_TOKEN');
  if (!token) throw new Error('GBRAIN_TOKEN no configurado: no se puede escribir la reunion al brain.');

  const { datos, mime } = await leerGrabacion(aviso.path);
  const ext = aviso.path.split('.').pop()?.toLowerCase() ?? 'webm';
  const transcript = await transcribirConGroq(datos, mime, `audio.${EXT_A_GROQ[ext] ?? 'webm'}`);
  if (!transcript) throw new Error('Groq Whisper devolvio una transcripcion vacia');

  const minuta = await redactarMinuta(transcript, aviso.titulo, aviso.proyecto);

  const fecha = new Date();
  const fechaIso = fecha.toISOString();
  const tag = tagDeProyecto(aviso.proyecto);
  const title = aviso.titulo || `Reunion ${fechaIso.slice(0, 10)}`;
  const slug = `reunion-os-${fechaIso.slice(0, 10)}-${fecha.getTime().toString(36)}`;
  const body = `${minuta}\n\n## Transcripcion completa\n\n${transcript}\n\nRelacionado: [[reunion]] [[pancho-os]]`;
  const sourceRef = `os:grabacion:${aviso.path}`;
  const tenant = readEnv('GBRAIN_TENANT_ID') ?? 'pancho';

  const input: BrainWriteClientInput = {
    target: 'brain',
    op: 'create',
    slug,
    title,
    body,
    tags: Array.from(new Set(['os', tag])),
    wikilinks: ['reunion', 'pancho-os'],
    evidence: { source: 'os', source_ref: sourceRef, observed_at: fechaIso, confidence: 2 },
    dedupe_key: await createDedupeKey(tenant, title, sourceRef),
  };
  const write = bindBrainWriteToTenant(tenant, 'human', input);
  const validacion = validateBrainWrite(write);
  if (!validacion.ok) throw new Error(`brain-write invalido: ${validacion.issues.join('; ')}`);

  const brain = createGbrainClient(token);
  await brain.putPage({ slug, title, body, type: 'report', tags: write.tags });

  return { slug };
}

/** Normaliza el proyecto al catalogo cerrado, cayendo a 'otros'. */
export function normalizarProyecto(raw: unknown): string {
  const p = String(raw ?? 'otros').toLowerCase();
  return PROYECTOS.includes(p) ? p : 'otros';
}
