export const prerender = false;

// Backend de os_revisiones: contenido jsonb libre para weekly/monthly review y el reset
// de 90 dias, indexado por (tipo, periodo). Reemplaza el demo estatico en
// os/data/revision.ts.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const TIPOS = ['semanal', 'mensual', 'reset90', 'anual', 'trimestral'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const tipo = context.url.searchParams.get('tipo');
    if (!tipo || !TIPOS.includes(tipo)) {
      return json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` }, 400);
    }
    const sb = getSupabaseServer();
    const periodo = context.url.searchParams.get('periodo');

    if (periodo) {
      const { data, error } = await sb
        .from('os_revisiones')
        .select('*')
        .eq('tipo', tipo)
        .eq('periodo', periodo)
        .maybeSingle();
      if (error) throw error;
      return json({ revision: data ?? null });
    }

    const { data, error } = await sb
      .from('os_revisiones')
      .select('*')
      .eq('tipo', tipo)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ revisiones: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PUT: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const tipo = typeof body.tipo === 'string' ? body.tipo.trim() : '';
    if (!TIPOS.includes(tipo)) {
      return json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` }, 400);
    }
    const periodo = typeof body.periodo === 'string' ? body.periodo.trim() : '';
    if (!periodo) return json({ error: 'periodo requerido' }, 400);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_revisiones')
      .upsert(
        [{ tipo, periodo, contenido: body.contenido ?? {}, updated_at: new Date().toISOString() }],
        { onConflict: 'tipo,periodo' }
      )
      .select()
      .single();
    if (error) throw error;
    return json({ revision: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
