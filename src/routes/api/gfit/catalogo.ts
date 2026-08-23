// Server route del catalogo de ejercicios de GFIT, portado de
// src/pages/api/gfit/catalogo.ts (Astro) a TanStack Start.
//
// Mismo molde que dias.ts y sesion-series.ts (los otros gfit ya portados):
// logica inline, mismo contrato HTTP, sin handler aparte. Solo lectura.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg } from '../../../lib/salud/apiHelpers.ts';

type SupabaseServer = ReturnType<typeof getSupabaseServer>;

const SEL_ALTERNATIVA = 'id,slug,nombre_en,nombre_es,patron,musculos_primarios,equipo,imagenes';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// Agrupa gfit_taxonomia (equipo|patron|grupo_muscular|sub_musculo) por tipo, para
// alimentar los selects/filtros de la UI de un solo golpe.
async function cargarTaxonomia(sb: SupabaseServer) {
  const { data, error } = await sb
    .from('gfit_taxonomia')
    .select('*')
    .order('tipo', { ascending: true })
    .order('orden', { ascending: true });
  if (error) throw error;
  const grupos: Record<string, unknown[]> = {};
  for (const fila of data ?? []) {
    const tipo = (fila as any).tipo ?? 'otro';
    if (!grupos[tipo]) grupos[tipo] = [];
    grupos[tipo].push(fila);
  }
  return grupos;
}

// Alternativas para el Swap sheet: ejercicios que comparten patrón o algún grupo
// muscular primario con el ejercicio dado, excluyéndolo, tope 20.
async function cargarAlternativas(sb: SupabaseServer, ejercicioId: string) {
  const { data: base, error: errBase } = await sb
    .from('ejercicios_catalogo')
    .select('id,patron,musculos_primarios')
    .eq('id', ejercicioId)
    .maybeSingle();
  if (errBase) throw errBase;
  if (!base) return [];

  const encontrados = new Map<string, unknown>();

  if (base.patron) {
    const { data, error } = await sb
      .from('ejercicios_catalogo')
      .select(SEL_ALTERNATIVA)
      .eq('patron', base.patron)
      .neq('id', ejercicioId)
      .limit(20);
    if (error) throw error;
    for (const fila of data ?? []) encontrados.set((fila as any).id, fila);
  }

  const grupos: string[] = Array.isArray(base.musculos_primarios)
    ? Array.from(new Set(base.musculos_primarios.map((m: any) => m?.grupo).filter(Boolean)))
    : [];
  for (const grupo of grupos) {
    if (encontrados.size >= 20) break;
    const { data, error } = await sb
      .from('ejercicios_catalogo')
      .select(SEL_ALTERNATIVA)
      .contains('musculos_primarios', [{ grupo }])
      .neq('id', ejercicioId)
      .limit(20);
    if (error) throw error;
    for (const fila of data ?? []) encontrados.set((fila as any).id, fila);
  }

  return Array.from(encontrados.values()).slice(0, 20);
}

export const Route = createFileRoute('/api/gfit/catalogo')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          const sb = getSupabaseServer();

          if (url.searchParams.get('taxonomia')) {
            return json({ taxonomia: await cargarTaxonomia(sb) });
          }

          const alternativas = url.searchParams.get('alternativas');
          if (alternativas) {
            return json({ alternativas: await cargarAlternativas(sb, alternativas) });
          }

          const q = url.searchParams.get('q')?.trim();
          const equipo = url.searchParams.get('equipo')?.trim();
          const patron = url.searchParams.get('patron')?.trim();
          const grupo = url.searchParams.get('grupo')?.trim();
          const nivel = url.searchParams.get('nivel')?.trim();
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
          const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

          let query = sb.from('ejercicios_catalogo').select('*', { count: 'exact' });

          if (q) {
            // Sin comas: rompen la sintaxis .or() de PostgREST. Es una búsqueda simple ilike.
            const termino = q.replace(/,/g, ' ').trim();
            query = query.or(`nombre_en.ilike.%${termino}%,nombre_es.ilike.%${termino}%,slug.ilike.%${termino}%`);
          }
          if (equipo) query = query.contains('equipo', [equipo]);
          if (patron) query = query.eq('patron', patron);
          if (grupo) query = query.contains('musculos_primarios', [{ grupo }]);
          if (nivel) query = query.eq('nivel', nivel);

          query = query.order('nombre_es', { ascending: true }).range(offset, offset + limit - 1);

          const { data, error, count } = await query;
          if (error) throw error;
          return json({ ejercicios: data ?? [], total: count ?? null, limit, offset });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
