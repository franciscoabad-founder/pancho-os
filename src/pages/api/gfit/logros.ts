export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, hoyGuayaquil } from '../../../lib/salud/apiHelpers';
import { registrarEvento } from '../../../lib/juego/motor';
import { estimar1RM } from '../../../lib/gfit/rm';
import { sugerirProgresion, type SerieReciente } from '../../../lib/gfit/progresion';
import { evaluarLogros, type ContextoLogros, type CatalogoLogro, type SerieConGrupo } from '../../../lib/gfit/logros';

// GET: catálogo completo + qué niveles ya se obtuvieron de cada uno (para la UI de logros).
// POST {evaluar:true}: recalcula evaluarLogros() sobre los datos reales, inserta los
// logros nuevos en gfit_logros_obtenidos y dispara el evento 'logro' en xp_events por
// cada uno (fire-and-forget, mismo patrón que api/os/salud/sesiones.ts).

interface LogroRow {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  ciencia: string;
  premio_xp: number;
  premio_oro: number;
  umbral: Record<string, unknown> & { tipo: string };
  orden: number | null;
  activo: boolean;
}

interface SerieRow {
  sesion_id: string;
  ejercicio_id: string;
  tipo: string;
  peso_kg: number | null;
  reps: number | null;
  completada_at: string;
  sesion: { fecha: string } | null;
  ejercicio: {
    patron: string | null;
    musculos_primarios: Array<{ grupo?: string | null }>;
  } | null;
}

function gruposDe(ejercicio: SerieRow['ejercicio']): string[] {
  if (!Array.isArray(ejercicio?.musculos_primarios)) return [];
  return Array.from(new Set(ejercicio!.musculos_primarios.map((m) => m?.grupo).filter((g): g is string => !!g)));
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const [{ data: catalogo, error: errCat }, { data: obtenidos, error: errObt }] = await Promise.all([
      sb.from('gfit_logros').select('*').order('orden', { ascending: true }),
      sb.from('gfit_logros_obtenidos').select('nivel, obtenido_at, logro:gfit_logros(slug)'),
    ]);
    if (errCat) throw errCat;
    if (errObt) throw errObt;

    const nivelesPorSlug = new Map<string, Array<{ nivel: number; obtenido_at: string }>>();
    for (const o of (obtenidos ?? []) as any[]) {
      const slug = o.logro?.slug;
      if (!slug) continue;
      if (!nivelesPorSlug.has(slug)) nivelesPorSlug.set(slug, []);
      nivelesPorSlug.get(slug)!.push({ nivel: o.nivel, obtenido_at: o.obtenido_at });
    }

    const logros = ((catalogo ?? []) as LogroRow[]).map((l) => ({
      ...l,
      obtenidos: (nivelesPorSlug.get(l.slug) ?? []).sort((a, b) => a.nivel - b.nivel),
    }));

    return json({ logros });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json().catch(() => ({}));
    if (!body?.evaluar) return json({ error: 'body.evaluar debe ser true' }, 400);

    const sb = getSupabaseServer();
    const hoy = hoyGuayaquil();

    const [{ data: catalogoRaw, error: errCat }, { data: obtenidosRaw, error: errObt }, { data: sesionesRaw, error: errSes }, { data: seriesRaw, error: errSer }] =
      await Promise.all([
        sb.from('gfit_logros').select('*'),
        sb.from('gfit_logros_obtenidos').select('nivel, logro:gfit_logros(slug)'),
        sb.from('sesiones').select('id, fecha').order('fecha', { ascending: true }),
        sb
          .from('gfit_sesion_series')
          .select(
            'sesion_id, ejercicio_id, tipo, peso_kg, reps, completada_at, ' +
              'sesion:sesiones(fecha), ejercicio:ejercicios_catalogo(patron, musculos_primarios)',
          )
          .order('completada_at', { ascending: true }),
      ]);
    if (errCat) throw errCat;
    if (errObt) throw errObt;
    if (errSes) throw errSes;
    if (errSer) throw errSer;

    const catalogo = (catalogoRaw ?? []) as LogroRow[];
    const catalogoLogros: CatalogoLogro[] = catalogo.map((l) => ({ slug: l.slug, activo: l.activo, umbral: l.umbral }));
    const porSlug = new Map(catalogo.map((l) => [l.slug, l]));

    const logrosPrevios = ((obtenidosRaw ?? []) as any[])
      .filter((o) => o.logro?.slug)
      .map((o) => ({ slug: o.logro.slug as string, nivel: o.nivel as number }));

    const sesiones = ((sesionesRaw ?? []) as Array<{ id: string; fecha: string }>).map((s) => ({ fecha: s.fecha }));
    const seriesRows = (seriesRaw ?? []) as unknown as SerieRow[];

    // Series expandidas: una entrada por (serie, grupo primario) -- un set compuesto
    // cuenta hacia cada grupo que trabaja (misma convención que muscleBreakdown).
    const seriesHistoricas: SerieConGrupo[] = [];
    for (const s of seriesRows) {
      const fecha = s.sesion?.fecha;
      if (!fecha) continue;
      const grupos = gruposDe(s.ejercicio);
      if (!grupos.length) {
        seriesHistoricas.push({ fecha, pesoKg: s.peso_kg, reps: s.reps, tipo: s.tipo, grupo: null });
        continue;
      }
      for (const grupo of grupos) {
        seriesHistoricas.push({ fecha, pesoKg: s.peso_kg, reps: s.reps, tipo: s.tipo, grupo });
      }
    }

    // ─── prNuevo: ¿alguna serie de HOY supera el 1RM histórico previo (antes de hoy) de su ejercicio? ──
    const mejorPrevio = new Map<string, number>();
    for (const s of seriesRows) {
      const fecha = s.sesion?.fecha;
      if (!fecha || fecha >= hoy || s.tipo !== 'working' || s.peso_kg == null || s.reps == null) continue;
      const est = estimar1RM(s.peso_kg, s.reps);
      if (est > (mejorPrevio.get(s.ejercicio_id) ?? 0)) mejorPrevio.set(s.ejercicio_id, est);
    }
    let prNuevo = false;
    for (const s of seriesRows) {
      const fecha = s.sesion?.fecha;
      if (fecha !== hoy || s.tipo !== 'working' || s.peso_kg == null || s.reps == null) continue;
      const previo = mejorPrevio.get(s.ejercicio_id);
      if (!previo) continue; // sin baseline previo: no cuenta como "récord", ver primera_sesion
      if (estimar1RM(s.peso_kg, s.reps) > previo) {
        prNuevo = true;
        break;
      }
    }

    // ─── dobleProgresionCompletada: heurística best-effort. Si antes de hoy la
    // sugerencia de progresión doble era "subir_carga" para un ejercicio (tocó el
    // tope de reps 2 sesiones seguidas) y hoy el peso máximo usado en ese ejercicio
    // subió respecto a la sesión anterior, se interpreta como que el ciclo se
    // completó. Objetivo por defecto 'hipertrofia' (no se resuelve la rutina real
    // del día por simplicidad: la lib no depende de ese contexto).
    const porEjercicio = new Map<string, SerieRow[]>();
    for (const s of seriesRows) {
      if (!porEjercicio.has(s.ejercicio_id)) porEjercicio.set(s.ejercicio_id, []);
      porEjercicio.get(s.ejercicio_id)!.push(s);
    }
    let dobleProgresionCompletada = false;
    for (const [, filas] of porEjercicio) {
      const antesDeHoy = filas.filter((f) => f.sesion?.fecha && f.sesion.fecha < hoy);
      const deHoy = filas.filter((f) => f.sesion?.fecha === hoy && f.tipo === 'working' && f.peso_kg != null);
      if (!antesDeHoy.length || !deHoy.length) continue;
      const seriesRecientes: SerieReciente[] = antesDeHoy.map((f) => ({ fecha: f.sesion!.fecha, reps: f.reps, tipo: f.tipo }));
      const patron = antesDeHoy[0]?.ejercicio?.patron ?? null;
      const sugerencia = sugerirProgresion(seriesRecientes, 'hipertrofia', { patron });
      if (sugerencia.accion !== 'subir_carga') continue;

      const ultimaFechaAntes = antesDeHoy.reduce((max, f) => (f.sesion!.fecha > max ? f.sesion!.fecha : max), antesDeHoy[0].sesion!.fecha);
      const pesoAnteriorMax = Math.max(
        0,
        ...antesDeHoy.filter((f) => f.sesion?.fecha === ultimaFechaAntes && f.tipo === 'working').map((f) => Number(f.peso_kg) || 0),
      );
      const pesoHoyMax = Math.max(0, ...deHoy.map((f) => Number(f.peso_kg) || 0));
      if (pesoAnteriorMax > 0 && pesoHoyMax > pesoAnteriorMax) {
        dobleProgresionCompletada = true;
        break;
      }
    }

    const contexto: ContextoLogros = {
      catalogo: catalogoLogros,
      logrosPrevios,
      sesiones,
      seriesHistoricas,
      hoy,
      prNuevo,
      dobleProgresionCompletada,
    };

    const nuevos = evaluarLogros(contexto);
    const otorgados: Array<{ slug: string; nivel: number; nombre: string; premio_xp: number; premio_oro: number }> = [];

    for (const n of nuevos) {
      const logro = porSlug.get(n.slug);
      if (!logro) continue;
      const { data: obtenido, error: errInsert } = await sb
        .from('gfit_logros_obtenidos')
        .insert({ logro_id: logro.id, nivel: n.nivel })
        .select('id')
        .single();
      if (errInsert) {
        // 23505 = ya obtenido (colisión de unique logro_id+nivel): ignorar, no es un error real.
        if ((errInsert as { code?: string }).code === '23505') continue;
        continue;
      }
      registrarEvento(sb, {
        tipo: 'logro',
        ref_tabla: 'gfit_logros_obtenidos',
        ref_id: obtenido.id,
        xp: logro.premio_xp,
        oro: logro.premio_oro,
        meta: { slug: logro.slug, nivel: n.nivel, premio_xp: logro.premio_xp, premio_oro: logro.premio_oro },
      }).catch(() => null);
      otorgados.push({
        slug: logro.slug,
        nivel: n.nivel,
        nombre: logro.nombre,
        premio_xp: logro.premio_xp,
        premio_oro: logro.premio_oro,
      });
    }

    return json({ ok: true, otorgados });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
