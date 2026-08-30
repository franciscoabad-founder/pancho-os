/** Adaptadores de métricas sociales. No almacenan tokens ni llaman APIs sin configuración. */
export const PLATAFORMAS_REDES = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'website', 'newsletter', 'blog'] as const;
export type PlataformaRed = typeof PLATAFORMAS_REDES[number];

export interface MetricaRedNormalizada { plataforma: PlataformaRed; fecha: string; seguidores?: number; alcance?: number; impresiones?: number; interacciones?: number; publicaciones?: number; metadata?: Record<string, unknown> }
export interface AdaptadorRed { plataforma: PlataformaRed; disponible(): boolean; recolectar(desde: string, hasta: string): Promise<MetricaRedNormalizada[]> }

const envKey = (plataforma: PlataformaRed) => `REDES_${plataforma.toUpperCase()}_TOKEN`;
function adaptador(plataforma: PlataformaRed): AdaptadorRed {
  return { plataforma, disponible: () => Boolean(process.env[envKey(plataforma)]), async recolectar() { return []; } };
}

/** Registro único para que un worker n8n/GitHub/VPS pueda descubrir plataformas sin acoplarse a proveedores. */
export const adaptadoresRedes: ReadonlyArray<AdaptadorRed> = PLATAFORMAS_REDES.map(adaptador);
export function obtenerAdaptadorRed(plataforma: string): AdaptadorRed | undefined { return adaptadoresRedes.find((a) => a.plataforma === plataforma); }
