// Formato compartido del nombre de una sesion de Hermes en el OS.
//
// Antes cada componente rotulaba distinto y el peor caso era OSChat, que
// mostraba `titulo (83)` pegando el message_count al nombre, como si fueran
// mensajes sin leer. No lo son: message_count son mensajes acumulados de la
// sesion, incluyendo turnos de herramientas.
//
// Regla unica desde ahora: el desplegable muestra `Nombre · dd/mm HH:mm` con
// la fecha de ULTIMA ACTIVIDAD, y el conteo va en un chip aparte o en el
// tooltip. Un solo lugar para cambiarlo: OSChat, TaskiBubble y el cockpit
// importan de aca.

export interface SesionRotulable {
  id: string;
  source?: string;
  origen?: 'telegram' | 'os';
  title?: string | null;
  messageCount?: number;
  /** Epoch en milisegundos (el server ya normaliza los segundos de Hermes). */
  lastActive?: number | null;
  /** true = el nombre lo puso Pancho, no el auto-titulador de Hermes. */
  alias?: boolean;
  tituloHermes?: string | null;
}

export const SESION_OS_ID = 'pancho-os';

/**
 * `dd/mm HH:mm` de la ultima actividad. Cadena vacia si no hay fecha usable,
 * para que el llamador no tenga que pintar un separador huerfano.
 *
 * Tolera epoch en segundos por si algun endpoint entrega el valor crudo de
 * Hermes sin pasar por aMilisegundos() del server.
 */
export function fechaSesion(lastActive: number | null | undefined): string {
  if (typeof lastActive !== 'number' || !Number.isFinite(lastActive) || lastActive <= 0) return '';
  const ms = lastActive < 1e12 ? lastActive * 1000 : lastActive;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

/** Nombre a secas, sin fecha ni conteo. */
export function nombreSesion(s: SesionRotulable): string {
  const titulo = (s.title ?? '').trim();
  if (titulo) return titulo;
  if (s.id === SESION_OS_ID) return 'Taski (OS)';
  if (s.origen === 'telegram' || s.source === 'telegram') return 'Conversacion de Telegram';
  if (s.id.startsWith('os-chat-')) return 'Conversacion del OS';
  return s.id.slice(0, 12);
}

/** `Nombre · dd/mm HH:mm`. Sin fecha, solo el nombre. */
export function etiquetaSesion(s: SesionRotulable): string {
  const fecha = fechaSesion(s.lastActive);
  return fecha ? `${nombreSesion(s)} · ${fecha}` : nombreSesion(s);
}

/** Texto del tooltip: de donde viene, cuantos mensajes y el titulo original. */
export function tooltipSesion(s: SesionRotulable): string {
  const partes = [nombreSesion(s)];
  const fecha = fechaSesion(s.lastActive);
  if (fecha) partes.push(`Ultima actividad: ${fecha}`);
  if (typeof s.messageCount === 'number') {
    partes.push(`${s.messageCount} mensajes acumulados (incluye turnos de herramientas, no son sin leer)`);
  }
  if (s.alias && s.tituloHermes) partes.push(`Titulo en Hermes: ${s.tituloHermes}`);
  partes.push(`id: ${s.id}`);
  return partes.join('\n');
}
