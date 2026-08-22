// Server route de ejercicios planificados por dia de GFIT, portado de
// src/pages/api/gfit/dia-ejercicios.ts (Astro) a TanStack Start. Mismo molde
// que dias.ts. gfit_dia_hoy (src/mcp/osTools.ts) depende de GET
// /api/gfit/dia-ejercicios?dia_id=... para traer el detalle del dia de hoy.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg, numOrNull } from '../../../lib/salud/apiHelpers.ts';

// Series de trabajo por defecto al agregar un ejercicio a un día: 3 series de
// trabajo, reps objetivo 10 (punto medio del rango convencional 8-12) y 90s de
// descanso. Es solo un punto de partida cómodo; el usuario las ajusta después.
const SERIES_DEFAULT = { cantidad: 3, tipo: 'working', reps: 10, descansoS: 90 };

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// POST {reordenar:[{id,orden}...]}: batch reorder (drag & drop en la UI).
async function reordenar(sb: ReturnType<typeof getSupabaseServer>, items: unknown) {
  if (!Array.isArray(items)) throw new Error('reordenar requiere un array');
  await Promise.all(
    items.map((it: any) => {
      if (!it?.id) return Promise.resolve();
      return sb.from('gfit_dia_ejercicios').update({ orden: Number(it.orden) || 0 }).eq('id', it.id);
    }),
  );
}

export const Route = createFileRoute('/api/gfit/dia-ejercicios')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        const diaId = url.searchParams.get('dia_id');
        try {
          const sb = getSupabaseServer();
          const sel = '*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*)';
          if (id) {
            const { data, error } = await sb.from('gfit_dia_ejercicios').select(sel).eq('id', id).single();
            if (error) throw error;
            return json({ dia_ejercicio: data });
          }
          if (!diaId) return json({ error: 'id o dia_id requerido' }, 400);
          const { data, error } = await sb
            .from('gfit_dia_ejercicios')
            .select(sel)
            .eq('dia_id', diaId)
            .order('orden', { ascending: true })
            .order('orden', { foreignTable: 'gfit_series_plan', ascending: true });
          if (error) throw error;
          return json({ dia_ejercicios: data ?? [] });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      POST: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const body = await request.json();
          const sb = getSupabaseServer();

          if ('reordenar' in body) {
            await reordenar(sb, body.reordenar);
            return json({ ok: true });
          }

          if (!body.dia_id) return json({ error: 'dia_id requerido' }, 400);
          if (!body.ejercicio_id) return json({ error: 'ejercicio_id requerido' }, 400);

          let orden = typeof body.orden === 'number' ? body.orden : null;
          if (orden == null) {
            const { count, error: errCount } = await sb
              .from('gfit_dia_ejercicios')
              .select('id', { count: 'exact', head: true })
              .eq('dia_id', body.dia_id);
            if (errCount) throw errCount;
            orden = count ?? 0;
          }

          const { data, error } = await sb
            .from('gfit_dia_ejercicios')
            .insert([{
              dia_id: body.dia_id,
              ejercicio_id: body.ejercicio_id,
              orden,
              superset_grupo: body.superset_grupo?.trim?.() || body.superset_grupo || null,
              notas: body.notas?.trim() || null,
            }])
            .select()
            .single();
          if (error) throw error;

          // Series de trabajo por defecto (convenience). Si falla, no revertimos el
          // dia_ejercicio ya creado: se devuelve igual, sin series (el usuario las agrega a mano).
          const filasSeries = Array.from({ length: SERIES_DEFAULT.cantidad }, (_, i) => ({
            dia_ejercicio_id: data.id,
            orden: i,
            tipo: SERIES_DEFAULT.tipo,
            peso_kg: null,
            reps: SERIES_DEFAULT.reps,
            descanso_s: SERIES_DEFAULT.descansoS,
          }));
          await sb.from('gfit_series_plan').insert(filasSeries);

          const { data: full } = await sb
            .from('gfit_dia_ejercicios')
            .select('*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*)')
            .eq('id', data.id)
            .single();
          return json({ ok: true, dia_ejercicio: full ?? data }, 201);
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      // PATCH ?id= {orden?, superset_grupo?, notas?, ejercicio_id?}: cambiar ejercicio_id
      // es un SWAP (mantiene las series planificadas tal cual, solo cambia el ejercicio de catálogo).
      PATCH: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const body = await request.json();
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if ('orden' in body) patch.orden = numOrNull(body.orden) ?? 0;
          if ('superset_grupo' in body) patch.superset_grupo = body.superset_grupo?.toString().trim() || null;
          if ('notas' in body) patch.notas = body.notas?.toString().trim() || null;
          if ('ejercicio_id' in body) {
            if (!body.ejercicio_id) return json({ error: 'ejercicio_id inválido' }, 400);
            patch.ejercicio_id = body.ejercicio_id;
          }
          const sb = getSupabaseServer();
          const { error } = await sb.from('gfit_dia_ejercicios').update(patch).eq('id', id);
          if (error) throw error;
          const { data: full, error: errFull } = await sb
            .from('gfit_dia_ejercicios')
            .select('*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*)')
            .eq('id', id)
            .single();
          if (errFull) throw errFull;
          return json({ ok: true, dia_ejercicio: full });
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
          const { error } = await sb.from('gfit_dia_ejercicios').delete().eq('id', id);
          if (error) throw error;
          return json({ ok: true });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
