// Perfiles REALES de Hermes (F2, 8 sep 2026).
//
// Ojo con la palabra "perfil": en el OS venia significando NODO (donde corre
// Hermes: vps-default, homelab-local, laptop-local). Un perfil de Hermes es
// otra cosa: es el agente, con su propio api_server, su propia memoria y su
// propia personalidad. Alfred (default) es el historico; arazza, nerio, rafik
// y taskr son los que el VPS esta publicando en Caddy como /taski-<perfil>.
//
// Este archivo vive en os/lib (y no en server/) a proposito: lo consumen tanto
// el frontend (selector del chat) como taski.handlers.ts, y asi el tipo tiene
// un solo dueno sin arrastrar codigo de servidor al bundle del navegador.

export type PerfilHermesId = 'default' | 'arazza' | 'nerio' | 'rafik' | 'taskr';

export interface PerfilHermesCatalogo {
  id: PerfilHermesId;
  etiqueta: string;
}

export const PERFILES_HERMES: PerfilHermesCatalogo[] = [
  { id: 'default', etiqueta: 'Alfred' },
  { id: 'arazza', etiqueta: 'Arazza' },
  { id: 'nerio', etiqueta: 'Nerio' },
  { id: 'rafik', etiqueta: 'Rafik' },
  { id: 'taskr', etiqueta: 'Taskr' },
];

/** Ids validos, para validar cuerpos de request sin repetir la lista. */
export const IDS_PERFILES_HERMES: PerfilHermesId[] = PERFILES_HERMES.map((p) => p.id);

export function etiquetaPerfilHermes(id: string): string {
  return PERFILES_HERMES.find((p) => p.id === id)?.etiqueta ?? id;
}

/** Cualquier basura cae a 'default': el perfil historico siempre existe. */
export function validarPerfilHermes(valor: unknown): PerfilHermesId {
  return IDS_PERFILES_HERMES.includes(valor as PerfilHermesId) ? (valor as PerfilHermesId) : 'default';
}
