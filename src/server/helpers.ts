// Helpers puros de servidor, extraidos de src/lib/salud/apiHelpers.ts.
//
// La version original importa `APIContext` de Astro (aunque solo como type), asi
// que no se usa directamente desde handlers de TanStack Start para mantenerlos
// libres de framework. Estas funciones son identicas en comportamiento.

const TZ = 'America/Guayaquil';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Pancho. */
export function hoyGuayaquil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Extrae el mensaje de un error desconocido para responder sin filtrar internals. */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  const anyErr = err as { message?: string };
  return anyErr?.message ?? 'error desconocido';
}
