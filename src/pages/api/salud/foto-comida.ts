export const prerender = false;

import type { APIRoute } from 'astro';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';

// Contrato completo del flujo n8n en apps/web/docs/contrato-foto-comida.md.

const MAX_BYTES = 4 * 1024 * 1024; // ~4MB decodificados
const TIMEOUT_MS = 25_000;

interface AlimentoEstimado {
  descripcion: string;
  cantidad_g: number | null;
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
}

// Extrae el base64 puro de una data URL ("data:image/jpeg;base64,XXXX"). Si ya viene sin
// prefijo, lo devuelve tal cual.
function extraerBase64(foto: string): string {
  const idx = foto.indexOf(',');
  if (foto.startsWith('data:') && idx !== -1) return foto.slice(idx + 1);
  return foto;
}

// Tamaño decodificado aproximado de un string base64, sin materializar el buffer completo.
function tamanoDecodificadoAprox(base64: string): number {
  const limpio = base64.replace(/\s/g, '');
  if (!limpio.length) return 0;
  const padding = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
  return Math.floor((limpio.length * 3) / 4) - padding;
}

// Valida el shape de la respuesta del webhook. Devuelve null si no cumple el contrato
// mínimo (así el endpoint responde 502 en vez de pasar basura al cliente).
function validarAlimentos(data: unknown): AlimentoEstimado[] | null {
  if (!data || typeof data !== 'object') return null;
  const alimentos = (data as Record<string, unknown>).alimentos;
  if (!Array.isArray(alimentos)) return null;

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const out: AlimentoEstimado[] = [];
  for (const a of alimentos) {
    if (!a || typeof a !== 'object') return null;
    const item = a as Record<string, unknown>;
    if (typeof item.descripcion !== 'string' || !item.descripcion.trim()) return null;
    out.push({
      descripcion: item.descripcion.trim(),
      cantidad_g: num(item.cantidad_g),
      kcal: num(item.kcal),
      proteina_g: num(item.proteina_g),
      carbos_g: num(item.carbos_g),
      grasa_g: num(item.grasa_g),
    });
  }
  return out;
}

// POST: recibe una foto (+ descripción opcional) y la reenvía al flujo n8n multimodal
// para estimar los alimentos. NO registra nada en comidas_log: el frontend confirma o
// edita la estimación y luego llama a /api/salud/comidas-log él mismo
// (principio manual-first, igual que ayunos).
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const webhookUrl = import.meta.env.N8N_FOTO_COMIDA_URL;
  if (!webhookUrl) {
    return json({ error: 'Flujo de foto no configurado (N8N_FOTO_COMIDA_URL)' }, 501);
  }

  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const fotoBase64 = typeof body.foto_base64 === 'string' ? body.foto_base64.trim() : '';
  if (!fotoBase64) return json({ error: 'foto_base64 requerido' }, 400);

  const soloBase64 = extraerBase64(fotoBase64);
  const bytes = tamanoDecodificadoAprox(soloBase64);
  if (bytes > MAX_BYTES) {
    return json({ error: `Foto demasiado grande (${(bytes / 1024 / 1024).toFixed(1)}MB, máx 4MB)` }, 413);
  }

  const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : undefined;
  const momento = typeof body.momento === 'string' ? body.momento.trim() : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = import.meta.env.OS_API_TOKEN;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-OS-Token': token } : {}),
      },
      body: JSON.stringify({ foto_base64: fotoBase64, descripcion, momento }),
      signal: controller.signal,
    });

    const raw = await res.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = (data as Record<string, unknown> | null)?.error;
      return json({ error: typeof msg === 'string' ? msg : `El flujo de foto respondió ${res.status}` }, 502);
    }

    const alimentos = validarAlimentos(data);
    if (!alimentos) {
      return json({ error: 'Respuesta del flujo de foto con formato inesperado' }, 502);
    }

    const parsed = data as Record<string, unknown>;
    const confianza = typeof parsed.confianza === 'number' ? parsed.confianza : null;
    const notas = typeof parsed.notas === 'string' ? parsed.notas : null;

    return json({ estimacion: { alimentos, confianza, notas } });
  } catch (err) {
    const abortado = err instanceof Error && err.name === 'AbortError';
    return json({ error: abortado ? 'El flujo de foto no respondió a tiempo (25s)' : errMsg(err) }, 502);
  } finally {
    clearTimeout(timeout);
  }
};
