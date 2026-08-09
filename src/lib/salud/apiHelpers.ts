import type { APIContext } from 'astro';

/**
 * Autoriza escritura externa (balanza Renpho, Fitbit, n8n, Telegram) vía header
 * `X-OS-Token` validado contra la env server-side OS_API_TOKEN. No expone el token.
 * Se usa ADEMÁS del os_auth normal: si el request trae cookie válida ya pasó el middleware.
 */
export function isExternalTokenAuthorized(context: Pick<APIContext, 'request'>): boolean {
  const header = context.request.headers.get('x-os-token');
  const token = import.meta.env.OS_API_TOKEN;
  return !!(header && token && header === token);
}

const TZ = 'America/Guayaquil';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Pancho. */
export function hoyGuayaquil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Convierte a número o null (acepta strings, vacíos, undefined). */
export function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Extrae el mensaje de un error desconocido para responder sin filtrar internals. */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  const anyErr = err as { message?: string };
  return anyErr?.message ?? 'error desconocido';
}
