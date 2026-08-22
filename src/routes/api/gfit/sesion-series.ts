// Server route de series ejecutadas en una sesion de GFIT, portado de
// src/pages/api/gfit/sesion-series.ts (Astro) a TanStack Start. Mismo molde
// que dias.ts. gfit_registrar_serie (src/mcp/osTools.ts) depende de POST
// /api/gfit/sesion-series.
//
// Molde A (mismo patrón que api/os/gfit/series.ts, pero sobre gfit_sesion_series:
// el registro REAL de series ejecutadas en una sesión, no el plan de la rutina).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg, numOrNull } from '../../../lib/salud/apiHelpers.ts';
import { pesoDesdeInput, type UnidadPeso } from '../../../lib/gfit/unidades.ts';

const TIPOS = ['warmup', 'working', 'drop', 'failure'];

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// Acepta peso_kg directo (ya canónico) o {peso, unidad} en la unidad preferida del
// usuario, convertido aquí a peso_kg canónico. Nunca se guarda en libras.
function resolverPesoKg(body: Record<string, unknown>): number | null | undefined {
  if ('peso_kg' in body) return numOrNull(body.peso_kg);
  if ('peso' in body) {
    const unidad: UnidadPeso = body.unidad === 'lb' ? 'lb' : 'kg';
    const peso = numOrNull(body.peso);
    return peso == null ? null : pesoDesdeInput(peso, unidad);
  }
  return undefined; // no se envió peso: no tocar el campo (PATCH) / null (POST)
}

export const Route = createFileRoute('/api/gfit/sesion-series')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const url = new URL(request.url);
        try {
          const sesionId = url.searchParams.get('sesion_id');
          if (!sesionId) return json({ error: 'sesion_id requerido' }, 400);
          const sb = getSupabaseServer();
          const { data, error } = await sb
            .from('gfit_sesion_series')
            .select('*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,musculos_primarios,patron)')
            .eq('sesion_id', sesionId)
            .order('orden', { ascending: true });
          if (error) throw error;
          return json({ series: data ?? [] });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      POST: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const body = await request.json();
          if (!body.sesion_id) return json({ error: 'sesion_id requerido' }, 400);
          if (!body.ejercicio_id) return json({ error: 'ejercicio_id requerido' }, 400);
          const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'working';

          const sb = getSupabaseServer();
          const { count, error: errCount } = await sb
            .from('gfit_sesion_series')
            .select('id', { count: 'exact', head: true })
            .eq('sesion_id', body.sesion_id);
          if (errCount) throw errCount;
          const orden = typeof body.orden === 'number' ? body.orden : (count ?? 0);

          const pesoKg = resolverPesoKg(body);
          const { data, error } = await sb
            .from('gfit_sesion_series')
            .insert([{
              sesion_id: body.sesion_id,
              dia_ejercicio_id: body.dia_ejercicio_id || null,
              ejercicio_id: body.ejercicio_id,
              orden,
              tipo,
              peso_kg: pesoKg ?? null,
              reps: numOrNull(body.reps),
              duracion_s: numOrNull(body.duracion_s),
            }])
            .select()
            .single();
          if (error) throw error;
          return json({ ok: true, serie: data }, 201);
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      PATCH: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = await request.json();
          const patch: Record<string, unknown> = {};
          if ('tipo' in body) {
            if (!TIPOS.includes(body.tipo)) return json({ error: 'tipo inválido' }, 400);
            patch.tipo = body.tipo;
          }
          if ('orden' in body) patch.orden = numOrNull(body.orden) ?? 0;
          if ('reps' in body) patch.reps = numOrNull(body.reps);
          if ('duracion_s' in body) patch.duracion_s = numOrNull(body.duracion_s);
          if ('dia_ejercicio_id' in body) patch.dia_ejercicio_id = body.dia_ejercicio_id || null;
          const pesoKg = resolverPesoKg(body);
          if (pesoKg !== undefined) patch.peso_kg = pesoKg;

          const sb = getSupabaseServer();
          const { data, error } = await sb.from('gfit_sesion_series').update(patch).eq('id', id).select().single();
          if (error) throw error;
          return json({ ok: true, serie: data });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      DELETE: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const sb = getSupabaseServer();
          const { error } = await sb.from('gfit_sesion_series').delete().eq('id', id);
          if (error) throw error;
          return json({ ok: true });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
