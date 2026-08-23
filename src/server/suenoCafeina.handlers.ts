// Logica de /api/salud/sueno/cafeina, portada de
// src/pages/api/salud/sueno/cafeina.ts.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { BEBIDAS, LIMITE_DIARIO_MG, totalDelDia } from '../lib/sueno/cafeina.ts';
import { restarDias } from '../lib/sueno/deuda.ts';

const TZ = 'America/Guayaquil';

/** ?fecha= (default hoy) o ?desde=&hasta= -> { dosis, total_mg, limite_mg, bebidas } */
export async function leerCafeina(params: {
  desde: string | null;
  hasta: string | null;
  fecha: string | null;
}) {
  const hasta = params.hasta || params.fecha || hoyGuayaquil();
  const desde = params.desde || params.fecha || restarDias(hasta, 6);

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('cafeina_log')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('tomado_at', { ascending: false });
  if (error) throw error;

  const dosis = data ?? [];
  const hoy = hoyGuayaquil();
  const deHoy = dosis.filter((d) => d.fecha === hoy);
  return {
    dosis,
    total_mg: totalDelDia(deHoy.map((d) => ({ tomadoMs: Date.parse(d.tomado_at), mg: d.mg }))),
    limite_mg: LIMITE_DIARIO_MG,
    bebidas: BEBIDAS,
  };
}

/**
 * { mg?, bebida?, tomado_at? } -> registra una dosis. Con `bebida` y sin `mg`,
 * toma los mg de referencia del catalogo.
 */
export async function registrarCafeina(body: Record<string, any>) {
  let mg: number | null = null;
  if (body.mg !== undefined && body.mg !== null && body.mg !== '') {
    const n = Number(body.mg);
    if (!Number.isFinite(n) || n <= 0 || n > 1000) throw error400('mg debe estar entre 1 y 1000');
    mg = Math.round(n);
  }

  const bebida = typeof body.bebida === 'string' && body.bebida.trim() ? body.bebida.trim() : null;
  if (mg === null) {
    const ref = BEBIDAS.find((b) => b.key === bebida);
    if (!ref) throw error400('se requiere mg, o una bebida del catalogo');
    mg = ref.mg;
  }

  const tomadoMs = typeof body.tomado_at === 'string' ? Date.parse(body.tomado_at) : Date.now();
  if (!Number.isFinite(tomadoMs)) throw error400('tomado_at no es una fecha valida');
  const tomado = new Date(tomadoMs);

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('cafeina_log')
    .insert({
      fecha: tomado.toLocaleDateString('en-CA', { timeZone: TZ }),
      tomado_at: tomado.toISOString(),
      mg,
      bebida,
      fuente: typeof body.fuente === 'string' && body.fuente.trim() ? body.fuente.trim() : 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarCafeina(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('cafeina_log').delete().eq('id', id);
  if (error) throw error;
}
