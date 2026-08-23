// Server route de rutinas de GFIT, portado de src/pages/api/gfit/rutinas.ts
// (Astro) a TanStack Start.
//
// Mismo molde que src/routes/api/tareas.ts: la logica se porta inline (no hay
// handlers compartidos como en tareas.handlers.ts, este endpoint no tiene un
// segundo caller ademas de la UI y el MCP). El contrato HTTP se mantiene
// identico (mismas rutas, verbos, status y claves) para que
// src/os/components/gfit/** siga funcionando sin tocarse, y para que
// gfit_dia_hoy (src/mcp/osTools.ts) pueda seguir haciendo fetch interno a
// /api/gfit/rutinas.
//
// Este es el UNICO motor de rutinas que se porta. El viejo
// /api/salud/rutinas + /api/salud/ejercicios (tablas rutinas /
// rutina_ejercicios / ejercicios, consumidas solo por la pagina huerfana
// /salud/entrenamiento) queda fuera del port a proposito: se verifico en la
// base que solo tiene filas de seed y cero uso real, y se deja morir con
// Astro en master. Si buscas src/routes/api/salud/rutinas.ts o ejercicios.ts,
// no existen y no hay que crearlos. Detalle de la verificacion y del retiro
// del allowlist MCP en el comentario de MCP_OS_MODULES en src/mcp/osTools.ts.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg } from '../../../lib/salud/apiHelpers.ts';

const OBJETIVOS = ['fuerza', 'hipertrofia', 'resistencia'];
const ESTADOS = ['activa', 'archivada'];

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/gfit/rutinas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const url = new URL(request.url);
        try {
          const sb = getSupabaseServer();
          const id = url.searchParams.get('id');
          const selDetalle =
            '*, dias:gfit_dias(*, gfit_dia_ejercicios(*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*)))';
          if (id) {
            const { data, error } = await sb.from('gfit_rutinas').select(selDetalle).eq('id', id).single();
            if (error) throw error;
            return json({ rutina: data });
          }

          let q = sb
            .from('gfit_rutinas')
            .select('*, dias:gfit_dias(count)')
            .order('created_at', { ascending: false });

          const estado = url.searchParams.get('estado');
          const all = url.searchParams.get('all');
          if (!all) {
            if (estado && ESTADOS.includes(estado)) q = q.eq('estado', estado);
            else q = q.eq('estado', 'activa');
          }

          const { data, error } = await q;
          if (error) throw error;
          return json({ rutinas: data ?? [] });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      POST: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const body = await request.json();
          if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
          if (body.objetivo && !OBJETIVOS.includes(body.objetivo)) {
            return json({ error: 'objetivo inválido' }, 400);
          }
          const sb = getSupabaseServer();
          const { data, error } = await sb
            .from('gfit_rutinas')
            .insert([{
              nombre: body.nombre.trim(),
              descripcion: body.descripcion?.trim() || null,
              objetivo: OBJETIVOS.includes(body.objetivo) ? body.objetivo : null,
              estado: 'activa',
            }])
            .select()
            .single();
          if (error) throw error;
          return json({ ok: true, rutina: data }, 201);
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
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if ('nombre' in body) {
            const nombre = body.nombre?.toString().trim();
            if (!nombre) return json({ error: 'nombre requerido' }, 400);
            patch.nombre = nombre;
          }
          if ('descripcion' in body) patch.descripcion = body.descripcion?.toString().trim() || null;
          if ('objetivo' in body) {
            if (body.objetivo && !OBJETIVOS.includes(body.objetivo)) return json({ error: 'objetivo inválido' }, 400);
            patch.objetivo = body.objetivo || null;
          }
          if ('estado' in body) {
            if (!ESTADOS.includes(body.estado)) return json({ error: 'estado inválido' }, 400);
            patch.estado = body.estado;
          }
          if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
          const sb = getSupabaseServer();
          const { data, error } = await sb.from('gfit_rutinas').update(patch).eq('id', id).select().single();
          if (error) throw error;
          return json({ ok: true, rutina: data });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      // Soft delete: no borra la rutina, la marca como archivada (conserva historial de sesiones).
      DELETE: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const sb = getSupabaseServer();
          const { data, error } = await sb
            .from('gfit_rutinas')
            .update({ estado: 'archivada', updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return json({ ok: true, rutina: data });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
