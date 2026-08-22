// Server route del dashboard de progreso de GFIT, portado de
// src/pages/api/gfit/progreso.ts (Astro) a TanStack Start. Mismo molde que
// dias.ts. gfit_consultar_progreso (src/mcp/osTools.ts) depende de GET
// /api/gfit/progreso.
//
// Devuelve TODO lo necesario para el dashboard de progreso de GFIT en un solo
// golpe: calendario de entrenos, volumen/tiempo por rango, breakdown muscular
// (3 meses), top 1RM por ejercicio (6 meses) y estado de recuperación por
// grupo (7 días). Molde: query paralela (Promise.all) + cómputo en memoria
// con las libs puras (lib/gfit/volumen.ts, lib/gfit/recovery.ts,
// lib/gfit/rm.ts), sin lógica de negocio aquí.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { errMsg, hoyGuayaquil } from '../../../lib/salud/apiHelpers.ts';
import { estimar1RM } from '../../../lib/gfit/rm.ts';
import {
  volumenPorRango,
  tiempoPorRango,
  muscleBreakdown,
  calendarioEntrenos,
  type SerieVolumen,
  type RangoVolumen,
} from '../../../lib/gfit/volumen.ts';
import {
  estadoRecuperacion,
  intensidadDeSerie,
  DEFAULT_INTENSIDAD_PCT,
  type EventoGrupo,
} from '../../../lib/gfit/recovery.ts';
import { addDias } from '../../../lib/habitos/fechas.ts';

interface SesionRow {
  id: string;
  fecha: string;
  duracion_min: number | null;
  inicio: string | null;
}

interface MusculoPrimario {
  grupo?: string | null;
  sub?: string | null;
}

interface SerieRow {
  id: string;
  sesion_id: string;
  ejercicio_id: string;
  tipo: string;
  peso_kg: number | null;
  reps: number | null;
  completada_at: string;
  sesion: { fecha: string; inicio: string | null } | null;
  ejercicio: { nombre_en: string; nombre_es: string | null; musculos_primarios: MusculoPrimario[] } | null;
}

const RANGOS: Array<{ key: string; rango: RangoVolumen }> = [
  { key: 'r7d', rango: '7d' },
  { key: 'r14d', rango: '14d' },
  { key: 'r1m', rango: '1m' },
  { key: 'r12m', rango: '12m' },
  { key: 'all', rango: 'all' },
];

function gruposDe(ejercicio: SerieRow['ejercicio']): string[] {
  if (!Array.isArray(ejercicio?.musculos_primarios)) return [];
  return Array.from(new Set(ejercicio!.musculos_primarios.map((m) => m?.grupo).filter((g): g is string => !!g)));
}

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/gfit/progreso')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const sb = getSupabaseServer();
          const hoy = hoyGuayaquil();

          const [sesionesRes, seriesRes] = await Promise.all([
            sb.from('sesiones').select('id, fecha, duracion_min, inicio').order('fecha', { ascending: true }),
            sb
              .from('gfit_sesion_series')
              .select(
                'id, sesion_id, ejercicio_id, tipo, peso_kg, reps, completada_at, ' +
                  'sesion:sesiones(fecha, inicio), ejercicio:ejercicios_catalogo(nombre_en, nombre_es, musculos_primarios)',
              )
              .order('completada_at', { ascending: true }),
          ]);
          if (sesionesRes.error) throw sesionesRes.error;
          if (seriesRes.error) throw seriesRes.error;

          const sesiones = (sesionesRes.data ?? []) as SesionRow[];
          const seriesRaw = (seriesRes.data ?? []) as unknown as SerieRow[];

          // ─── calendario: todas las fechas con al menos una sesión registrada ──────
          const calendario = calendarioEntrenos(sesiones.map((s) => ({ fecha: s.fecha })));

          // ─── series normalizadas (fecha de la sesión, no de la serie) ─────────────
          const seriesVolumen: SerieVolumen[] = seriesRaw
            .filter((s) => s.sesion?.fecha)
            .map((s) => ({ fecha: s.sesion!.fecha, pesoKg: s.peso_kg, reps: s.reps, tipo: s.tipo, ejercicioId: s.ejercicio_id }));

          const volumen: Record<string, ReturnType<typeof volumenPorRango>> = {};
          for (const { key, rango } of RANGOS) volumen[key] = volumenPorRango(seriesVolumen, rango, hoy);

          const sesionesTiempo = sesiones.map((s) => ({ fecha: s.fecha, duracionMin: s.duracion_min }));
          const tiempo: Record<string, ReturnType<typeof tiempoPorRango>> = {};
          for (const { key, rango } of RANGOS) tiempo[key] = tiempoPorRango(sesionesTiempo, rango, hoy);

          // ─── breakdown muscular (3 meses): grupos primarios por ejercicio ─────────
          const gruposPorEjercicio = new Map<string, string[]>();
          for (const s of seriesRaw) {
            if (s.ejercicio_id && !gruposPorEjercicio.has(s.ejercicio_id)) {
              gruposPorEjercicio.set(s.ejercicio_id, gruposDe(s.ejercicio));
            }
          }
          const ejerciciosParaBreakdown = Array.from(gruposPorEjercicio.entries()).map(([id, gruposPrimarios]) => ({
            id,
            gruposPrimarios,
          }));
          const breakdown3m = muscleBreakdown(seriesVolumen, ejerciciosParaBreakdown, 3, hoy);

          // ─── 1RM histórico "de todos los tiempos" por ejercicio (denominador de intensidad) ──
          const rmHistoricoTodo = new Map<string, number>();
          for (const s of seriesRaw) {
            if (s.tipo !== 'working' || s.peso_kg == null || s.reps == null) continue;
            const est = estimar1RM(s.peso_kg, s.reps);
            if (est <= 0) continue;
            if (est > (rmHistoricoTodo.get(s.ejercicio_id) ?? 0)) rmHistoricoTodo.set(s.ejercicio_id, est);
          }

          // ─── top 1RM por ejercicio (últimos 6 meses, top 12) ──────────────────────
          const desde6m = addDias(hoy, -180);
          const mejoresRecientes = new Map<string, { est: number; nombre: string }>();
          for (const s of seriesRaw) {
            if (s.tipo !== 'working' || s.peso_kg == null || s.reps == null) continue;
            const fecha = s.sesion?.fecha;
            if (!fecha || fecha < desde6m || fecha > hoy) continue;
            const est = estimar1RM(s.peso_kg, s.reps);
            if (est <= 0) continue;
            const actual = mejoresRecientes.get(s.ejercicio_id);
            if (!actual || est > actual.est) {
              mejoresRecientes.set(s.ejercicio_id, {
                est,
                nombre: s.ejercicio?.nombre_es || s.ejercicio?.nombre_en || 'Ejercicio',
              });
            }
          }
          const unoRm = Array.from(mejoresRecientes.entries())
            .map(([ejercicio_id, v]) => ({ ejercicio_id, nombre: v.nombre, est_1rm: v.est }))
            .sort((a, b) => b.est_1rm - a.est_1rm)
            .slice(0, 12);

          // ─── recovery: últimos 7 días, agregado por sesión+grupo ──────────────────
          const desde7d = addDias(hoy, -6);
          interface Acumulado {
            workingSets: number;
            intensidades: number[];
            fechaHora: string;
          }
          const porSesionGrupo = new Map<string, Acumulado>();
          for (const s of seriesRaw) {
            if (s.tipo === 'warmup') continue;
            const fecha = s.sesion?.fecha;
            if (!fecha || fecha < desde7d || fecha > hoy) continue;
            const grupos = gruposDe(s.ejercicio);
            if (!grupos.length) continue;
            const intensidad = intensidadDeSerie(s.peso_kg, rmHistoricoTodo.get(s.ejercicio_id) ?? null);
            const fechaHora = s.sesion?.inicio ?? `${fecha}T12:00:00`;
            for (const grupo of grupos) {
              const key = `${s.sesion_id}::${grupo}`;
              if (!porSesionGrupo.has(key)) porSesionGrupo.set(key, { workingSets: 0, intensidades: [], fechaHora });
              const acc = porSesionGrupo.get(key)!;
              acc.workingSets += 1;
              acc.intensidades.push(intensidad);
            }
          }
          const eventosRecovery: EventoGrupo[] = Array.from(porSesionGrupo.entries()).map(([key, acc]) => {
            const grupo = key.split('::')[1];
            const intensidadPct = acc.intensidades.length
              ? Math.round((acc.intensidades.reduce((a, b) => a + b, 0) / acc.intensidades.length) * 100) / 100
              : DEFAULT_INTENSIDAD_PCT;
            return { grupo, fecha: acc.fechaHora, workingSets: acc.workingSets, intensidadPct };
          });
          const recovery = estadoRecuperacion(eventosRecovery, new Date());

          return json({ calendario, volumen, tiempo, breakdown3m, unoRm, recovery });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
