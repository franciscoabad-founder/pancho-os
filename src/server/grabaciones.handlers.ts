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

// --- Aviso a n8n -------------------------------------------------------------

export interface AvisoTranscripcion {
  audioUrl: string;
  path: string;
  titulo: string;
  proyecto: string;
  duracion: number;
  mime: string;
}

export async function notificarTranscripcion(aviso: AvisoTranscripcion): Promise<void> {
  const webhook = readEnv('N8N_TRANSCRIBE_URL');
  if (!webhook) throw new Error('N8N_TRANSCRIBE_URL no configurado');

  const osToken = readEnv('OS_API_TOKEN') ?? readEnv('OS_AUTH_TOKEN');
  const res = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(osToken ? { 'X-OS-Token': osToken } : {}),
    },
    body: JSON.stringify({
      audio_url: aviso.audioUrl,
      path: aviso.path,
      titulo: aviso.titulo,
      proyecto: aviso.proyecto,
      duracion_s: aviso.duracion,
      mime: aviso.mime,
      fecha: new Date().toISOString(),
      source: 'os-grabar',
    }),
  });
  if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
}

/** Normaliza el proyecto al catalogo cerrado, cayendo a 'otros'. */
export function normalizarProyecto(raw: unknown): string {
  const p = String(raw ?? 'otros').toLowerCase();
  return PROYECTOS.includes(p) ? p : 'otros';
}
