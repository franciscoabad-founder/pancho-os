export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../../lib/supabase';
import { isOsAuthorized, json } from '../../../../os/lib/osAuth';
import { errMsg, hoyGuayaquil, isExternalTokenAuthorized } from '../../../../lib/salud/apiHelpers';
import { BEBIDAS, LIMITE_DIARIO_MG, totalDelDia } from '../../../../lib/sueno/cafeina';
import { restarDias } from '../../../../lib/sueno/deuda';

const TZ = 'America/Guayaquil';

// GET ?fecha= (default hoy) o ?desde=&hasta= -> { dosis, total_mg, limite_mg, bebidas }
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const { searchParams } = context.url;
    const hasta = searchParams.get('hasta') || searchParams.get('fecha') || hoyGuayaquil();
    const desde = searchParams.get('desde') || searchParams.get('fecha') || restarDias(hasta, 6);

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
    return json({
      dosis,
      total_mg: totalDelDia(deHoy.map((d) => ({ tomadoMs: Date.parse(d.tomado_at), mg: d.mg }))),
      limite_mg: LIMITE_DIARIO_MG,
      bebidas: BEBIDAS,
    });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// POST { mg? , bebida?, tomado_at? } -> registra una dosis. Con `bebida` y sin
// `mg`, toma los mg de referencia del catalogo.
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();

    let mg: number | null = null;
    if (body.mg !== undefined && body.mg !== null && body.mg !== '') {
      const n = Number(body.mg);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) return json({ error: 'mg debe estar entre 1 y 1000' }, 400);
      mg = Math.round(n);
    }

    const bebida = typeof body.bebida === 'string' && body.bebida.trim() ? body.bebida.trim() : null;
    if (mg === null) {
      const ref = BEBIDAS.find((b) => b.key === bebida);
      if (!ref) return json({ error: 'se requiere mg, o una bebida del catalogo' }, 400);
      mg = ref.mg;
    }

    const tomadoMs = typeof body.tomado_at === 'string' ? Date.parse(body.tomado_at) : Date.now();
    if (!Number.isFinite(tomadoMs)) return json({ error: 'tomado_at no es una fecha valida' }, 400);
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
    return json({ dosis: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// DELETE ?id=
export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('cafeina_log').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
