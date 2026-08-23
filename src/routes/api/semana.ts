// Server route de /api/semana, portado de src/pages/api/semana.ts (Astro) a
// TanStack Start.
//
// Mismo molde que src/routes/api/gfit/dias.ts: logica inline (no hay organo
// para "semana" todavia), mismo contrato HTTP que la version Astro (mismas
// rutas, mismos verbos, mismos codigos, mismas claves de respuesta) para que
// src/os/components/OSSemana.tsx (hoy montado via src/pages/semana.astro)
// pueda seguir hablando con fetch('/api/semana') sin cambios cuando se migre.
//
// Se creo puntualmente para destrabar la tool MCP semana_diseno
// (src/mcp/osTools.ts case 'semana_diseno'): sin este endpoint, executeOsTool
// pegaba contra una ruta inexistente y el router generico de TanStack Start
// devolvia "Only HTML requests are supported here" en vez de datos reales.
//
// EL MODELO (leer antes de tocar): Maker/Manager y promover/vender/construir/entregar
// son ejes ORTOGONALES.
//   * El MODO es una forma de atencion y vive en el DIA (os_semana.modo).
//   * La FUNCION es una etapa de la cadena de valor y vive en el BLOQUE (os_bloques.funcion).
//   * La CARA de un bloque NO esta guardada: se DERIVA cruzando su funcion con el modo de
//     su dia. Por eso el mismo bloque `vender` sugiere "reunion de ventas / revisar CRM" en
//     un dia manager y "escribir propuesta / armar deck" en un dia maker.
//   * Un dia `off` no tiene cara: no sugiere acciones.
//
// EL BALANCE se cuadra por SEMANA, no por dia: partir cada dia en tres fragmentaria el dia
// Maker, que es justo lo que Maker/Manager existe para evitar. Por eso el GET devuelve tres
// numeros por funcion, que responden tres preguntas distintas:
//   - horas_objetivo:     cuanto QUIERES darle (os_funcion_presupuesto).
//   - horas_planificadas: cuanto le da tu semana DISENADA (suma de bloques). Si esto no
//                         alcanza al objetivo, el problema es el diseno, no la disciplina.
//   - horas_reales:       cuanto le diste DE VERDAD (os_bloque_log de esa semana).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import { getSupabaseServer } from '../../server/supabase.ts';
import { errMsg, hoyGuayaquil, numOrNull } from '../../lib/salud/apiHelpers.ts';

const FUNCIONES = ['promover', 'vender', 'construir', 'entregar'] as const;
const MODOS = ['maker', 'manager', 'off'] as const;

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

/** Lunes (ISO) de la semana que contiene `fechaISO`. Opera en UTC a proposito: la fecha
 *  ya viene resuelta en Guayaquil, asi que aqui solo se hace aritmetica de calendario. */
function lunesDeLaSemana(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  const dow = d.getUTCDay();           // 0=Dom .. 6=Sab
  const iso = dow === 0 ? 7 : dow;     // 1=Lun .. 7=Dom
  d.setUTCDate(d.getUTCDate() - (iso - 1));
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Minutos entre dos columnas `time` ('08:00:00'). Devuelve 0 si falta alguna o si no avanza. */
function minutosEntre(inicio?: string | null, fin?: string | null): number {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  if ([h1, m1, h2, m2].some((n) => !Number.isFinite(n))) return 0;
  const a = h1 * 60 + m1;
  const b = h2 * 60 + m2;
  return b > a ? b - a : 0;
}

const redondear = (n: number) => Math.round(n * 10) / 10;

export const Route = createFileRoute('/api/semana')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const semanaParam = new URL(request.url).searchParams.get('semana');
          const semanaInicio = semanaParam
            ? lunesDeLaSemana(semanaParam)
            : lunesDeLaSemana(hoyGuayaquil());
          const semanaFin = sumarDias(semanaInicio, 6);

          const sb = getSupabaseServer();
          const [dias, bloques, acciones, presupuesto, log] = await Promise.all([
            sb.from('os_semana').select('*').order('dia'),
            sb.from('os_bloques').select('*').eq('activo', true).order('dia').order('orden'),
            sb.from('os_funcion_acciones').select('*').order('orden'),
            sb.from('os_funcion_presupuesto').select('*'),
            sb.from('os_bloque_log').select('*').gte('fecha', semanaInicio).lte('fecha', semanaFin),
          ]);
          for (const r of [dias, bloques, acciones, presupuesto, log]) if (r.error) throw r.error;

          // Indice de la matriz: funcion|cara -> acciones. La cara se resuelve por dia, mas abajo.
          const matriz = new Map<string, string[]>();
          for (const a of acciones.data ?? []) {
            const k = `${a.funcion}|${a.cara}`;
            if (!matriz.has(k)) matriz.set(k, []);
            matriz.get(k)!.push(a.accion);
          }

          const planificadas: Record<string, number> = {};
          const diasSalida = (dias.data ?? []).map((d) => {
            const propios = (bloques.data ?? []).filter((b) => b.dia === d.dia);
            const conCara = propios.map((b) => {
              // LA DERIVACION. Un dia `off` no tiene cara ni sugiere acciones.
              const cara = d.modo === 'off' ? null : d.modo;
              const minutos = minutosEntre(b.hora_inicio, b.hora_fin);
              if (d.modo !== 'off') {
                planificadas[b.funcion] = (planificadas[b.funcion] ?? 0) + minutos;
              }
              return {
                id: b.id,
                orden: b.orden,
                funcion: b.funcion,
                hora_inicio: b.hora_inicio,
                hora_fin: b.hora_fin,
                minutos,
                cara,
                acciones: cara ? (matriz.get(`${b.funcion}|${cara}`) ?? []) : [],
              };
            });
            return { ...d, bloques: conCara };
          });

          const reales: Record<string, number> = {};
          for (const l of log.data ?? []) {
            reales[l.funcion] = (reales[l.funcion] ?? 0) + (l.minutos ?? 0);
          }

          const presupuestoPorFuncion = new Map(
            (presupuesto.data ?? []).map((p) => [p.funcion, Number(p.horas_semana_objetivo)]),
          );

          const balance = FUNCIONES.map((f) => {
            const objetivo = presupuestoPorFuncion.get(f) ?? 0;
            const planif = redondear((planificadas[f] ?? 0) / 60);
            const real = redondear((reales[f] ?? 0) / 60);
            return {
              funcion: f,
              horas_objetivo: objetivo,
              horas_planificadas: planif,
              horas_reales: real,
              pct_real: objetivo > 0 ? Math.round((real / objetivo) * 100) : null,
            };
          });

          // Avisos. Se distingue a proposito el fallo de DISENO (tu semana no le da las horas
          // que dijiste querer) del fallo de EJECUCION (le diste horas en el diseno pero no las
          // usaste), porque la cura es distinta: redisenar la semana vs. sostenerla.
          const avisos: Array<{ nivel: string; funcion: string; mensaje: string }> = [];
          const hoy = hoyGuayaquil();
          const diaDeLaSemana = hoy >= semanaInicio && hoy <= semanaFin
            ? Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${semanaInicio}T00:00:00Z`)) / 86400000) + 1
            : 8; // semana pasada: se evalua completa
          for (const b of balance) {
            if (b.horas_objetivo <= 0) continue;
            if (b.horas_planificadas < b.horas_objetivo * 0.75) {
              avisos.push({
                nivel: 'alerta',
                funcion: b.funcion,
                mensaje: `Tu semana disenada solo le da ${b.horas_planificadas}h a ${b.funcion}, y tu objetivo son ${b.horas_objetivo}h. El problema es el diseno de la semana, no la disciplina.`,
              });
            } else if (diaDeLaSemana >= 4 && b.horas_reales < b.horas_objetivo * 0.5) {
              avisos.push({
                nivel: b.funcion === 'promover' ? 'alerta' : 'nudge',
                funcion: b.funcion,
                mensaje: `Vas ${b.horas_reales}h de ${b.horas_objetivo}h en ${b.funcion}${b.funcion === 'promover' ? '. Promover es el que siempre se muere primero.' : '.'}`,
              });
            }
          }

          return json({ semana_inicio: semanaInicio, semana_fin: semanaFin, dias: diasSalida, balance, avisos });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      // PATCH ?dia=N -> cambia el modo/etiqueta/sale/nota de un dia de la semana.
      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const dia = numOrNull(new URL(request.url).searchParams.get('dia'));
          if (dia === null || dia < 1 || dia > 7) return json({ error: 'dia debe ser 1..7 (ISO, 1=Lunes)' }, 400);
          const body = await request.json();

          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if ('modo' in body) {
            if (!MODOS.includes(body.modo)) return json({ error: `modo debe ser uno de: ${MODOS.join(', ')}` }, 400);
            patch.modo = body.modo;
          }
          for (const c of ['sale', 'etiqueta', 'nota']) if (c in body) patch[c] = body[c];

          const sb = getSupabaseServer();
          const { data, error } = await sb.from('os_semana').update(patch).eq('dia', dia).select().single();
          if (error) throw error;
          return json({ dia: data });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      // POST — tres acciones distintas segun el cuerpo:
      //   { bloque: {...} }      -> crea un bloque en un dia
      //   { log: {...} }         -> registra minutos reales de una funcion
      //   { presupuesto: {...} } -> ajusta el objetivo semanal de una funcion
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        let body: Record<string, any>;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'JSON invalido' }, 400);
        }

        try {
          const sb = getSupabaseServer();

          if (body.bloque) {
            const b = body.bloque;
            const dia = numOrNull(b.dia);
            if (dia === null || dia < 1 || dia > 7) return json({ error: 'bloque.dia debe ser 1..7' }, 400);
            if (!FUNCIONES.includes(b.funcion)) {
              return json({ error: `bloque.funcion debe ser una de: ${FUNCIONES.join(', ')}` }, 400);
            }
            const orden = numOrNull(b.orden);
            if (orden === null) return json({ error: 'bloque.orden requerido' }, 400);
            const { data, error } = await sb
              .from('os_bloques')
              .insert([{
                dia, orden, funcion: b.funcion,
                hora_inicio: b.hora_inicio ?? null,
                hora_fin: b.hora_fin ?? null,
              }])
              .select()
              .single();
            if (error) {
              // Choque con el unique (dia, orden) de los bloques activos: es error del cliente.
              if ((error as { code?: string }).code === '23505') {
                return json({ error: `Ya existe un bloque activo en el orden ${orden} de ese dia` }, 400);
              }
              throw error;
            }
            return json({ bloque: data });
          }

          if (body.log) {
            const l = body.log;
            if (!FUNCIONES.includes(l.funcion)) {
              return json({ error: `log.funcion debe ser una de: ${FUNCIONES.join(', ')}` }, 400);
            }
            const minutos = numOrNull(l.minutos);
            if (minutos === null || minutos <= 0) return json({ error: 'log.minutos debe ser > 0' }, 400);
            const { data, error } = await sb
              .from('os_bloque_log')
              .insert([{
                fecha: l.fecha ?? hoyGuayaquil(),
                bloque_id: l.bloque_id ?? null,
                funcion: l.funcion,
                minutos,
                nota: l.nota ?? null,
              }])
              .select()
              .single();
            if (error) throw error;
            return json({ log: data });
          }

          if (body.presupuesto) {
            const p = body.presupuesto;
            if (!FUNCIONES.includes(p.funcion)) {
              return json({ error: `presupuesto.funcion debe ser una de: ${FUNCIONES.join(', ')}` }, 400);
            }
            const horas = numOrNull(p.horas_semana_objetivo);
            if (horas === null || horas < 0) return json({ error: 'presupuesto.horas_semana_objetivo invalido' }, 400);
            const { data, error } = await sb
              .from('os_funcion_presupuesto')
              .upsert([{ funcion: p.funcion, horas_semana_objetivo: horas, updated_at: new Date().toISOString() }], {
                onConflict: 'funcion',
              })
              .select()
              .single();
            if (error) throw error;
            return json({ presupuesto: data });
          }

          return json({ error: 'Se requiere bloque, log o presupuesto' }, 400);
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },

      // DELETE ?bloque_id= -> baja logica del bloque (activo=false), para no romper los logs
      // historicos que lo referencian.
      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const bloqueId = new URL(request.url).searchParams.get('bloque_id');
          if (!bloqueId) return json({ error: 'bloque_id requerido' }, 400);
          const sb = getSupabaseServer();
          const { data, error } = await sb
            .from('os_bloques')
            .update({ activo: false })
            .eq('id', bloqueId)
            .select()
            .single();
          if (error) throw error;
          return json({ bloque: data });
        } catch (err) {
          return json({ error: errMsg(err) }, 502);
        }
      },
    },
  },
});
