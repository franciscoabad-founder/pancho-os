export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, hoyGuayaquil, isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { addDias } from '../../../lib/habitos/fechas';
import { falloAyer } from '../../../lib/habitos/racha';
import { calcularDeuda, formatearHoras, type NocheSueno } from '../../../lib/sueno/deuda';

type SB = ReturnType<typeof getSupabaseServer>;
type Severidad = 'info' | 'nudge' | 'alerta';

interface Insight {
  tipo: string;
  severidad: Severidad;
  mensaje: string;
  data?: Record<string, unknown>;
}

// Prioridad de orden (menor = primero): alerta > nudge > info.
const PESO_SEVERIDAD: Record<Severidad, number> = { alerta: 0, nudge: 1, info: 2 };

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Comidas: dias de los ultimos 3 sin ningun registro en comidas_log.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsComidas(sb: SB, hoy: string): Promise<Insight[]> {
  const desde = addDias(hoy, -2);
  const { data, error } = await sb.from('comidas_log').select('fecha').gte('fecha', desde).lte('fecha', hoy);
  if (error) throw error;
  const fechasConLog = new Set((data ?? []).map((d) => d.fecha as string));
  const diasSinLog: string[] = [];
  for (let i = 0; i < 3; i++) {
    const f = addDias(hoy, -i);
    if (!fechasConLog.has(f)) diasSinLog.push(f);
  }
  if (!diasSinLog.length) return [];
  const mensaje = diasSinLog.length === 3
    ? 'No estas trackeando comidas hace 3 dias. Registra aunque sea lo basico: el dato de hoy vale mas que la precision perfecta.'
    : `Te faltÃ³ registrar comidas ${diasSinLog.length === 1 ? 'un dÃ­a' : `${diasSinLog.length} dÃ­as`} de los Ãºltimos 3.`;
  return [{ tipo: 'comidas', severidad: 'nudge', mensaje, data: { dias_sin_log: diasSinLog } }];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ayuno: solo aplica a quien YA practica ayuno (existe al menos un registro
// historico en `ayunos`; salud_config.protocolo_ayuno_default trae un default
// NOT NULL para todos, asi que no sirve por si solo para distinguir "quiere
// ayunar" de "nunca lo ha usado"). Si practica y hoy no ha tocado el ayuno
// (manual-first: el timer nunca arranca solo), nudge.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsAyuno(sb: SB, hoy: string): Promise<Insight[]> {
  const { data: historial, error: errHistorial } = await sb.from('ayunos').select('id').limit(1);
  if (errHistorial) throw errHistorial;
  if (!historial || !historial.length) return [];

  const { data: ayunosHoy, error: errAyunos } = await sb
    .from('ayunos')
    .select('id')
    .gte('inicio', `${hoy}T00:00:00-05:00`)
    .lte('inicio', `${hoy}T23:59:59-05:00`)
    .limit(1);
  if (errAyunos) throw errAyunos;
  if (ayunosHoy && ayunosHoy.length) return [];

  const { data: config } = await sb
    .from('salud_config')
    .select('protocolo_ayuno_default')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const protocolo = (config as Record<string, unknown> | null)?.protocolo_ayuno_default ?? '16_8';

  return [{
    tipo: 'ayuno',
    severidad: 'nudge',
    mensaje: `Tienes el protocolo ${protocolo} configurado pero no has tocado el ayuno hoy. El timer es manual: iniciarlo depende de ti.`,
    data: { protocolo },
  }];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Entreno: dias desde la ultima sesion de gym + grupos musculares sin volumen 14d.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsEntreno(sb: SB, hoy: string): Promise<Insight[]> {
  const out: Insight[] = [];

  const { data: ultimaSesion, error: errUltima } = await sb
    .from('sesiones')
    .select('fecha')
    .eq('tipo', 'gym')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  let huboSesionesEnVentana = false;
  if (!errUltima) {
    if (!ultimaSesion) {
      out.push({ tipo: 'entreno', severidad: 'nudge', mensaje: 'Todavia no registras ninguna sesion de entrenamiento.' });
    } else {
      const dias = Math.round((new Date(`${hoy}T00:00:00`).getTime() - new Date(`${ultimaSesion.fecha}T00:00:00`).getTime()) / 86400000);
      if (dias > 3) {
        out.push({
          tipo: 'entreno',
          severidad: 'nudge',
          mensaje: `Llevas ${dias} dÃ­as sin entrenar. Retoma aunque sea con una sesiÃ³n corta.`,
          data: { dias_sin_entrenar: dias },
        });
      }
    }
  }

  // Grupos musculares sin volumen en los ultimos 14 dias (tablas GFIT: defensivo,
  // pueden no existir todavia en esta base).
  try {
    const desde14 = addDias(hoy, -13);
    const { data: sesionesRecientes } = await sb.from('sesiones').select('id').eq('tipo', 'gym').gte('fecha', desde14);
    const idsSesiones = (sesionesRecientes ?? []).map((s) => s.id as string);
    huboSesionesEnVentana = idsSesiones.length > 0;

    const gruposEntrenados = new Set<string>();
    if (idsSesiones.length) {
      const { data: series } = await sb.from('gfit_sesion_series').select('ejercicio_id').in('sesion_id', idsSesiones);
      const idsEjercicios = Array.from(new Set((series ?? []).map((s) => s.ejercicio_id as string)));
      if (idsEjercicios.length) {
        const { data: ejercicios } = await sb.from('ejercicios_catalogo').select('musculos_primarios').in('id', idsEjercicios);
        for (const e of ejercicios ?? []) {
          for (const m of (e.musculos_primarios ?? []) as Array<{ grupo?: string }>) {
            if (m?.grupo) gruposEntrenados.add(m.grupo);
          }
        }
      }
    }

    if (huboSesionesEnVentana) {
      const { data: gruposTodos } = await sb
        .from('gfit_taxonomia')
        .select('slug, nombre_es')
        .eq('tipo', 'grupo_muscular')
        .neq('slug', 'cardio');
      const faltantes = (gruposTodos ?? []).filter((g) => !gruposEntrenados.has(g.slug as string));
      if (faltantes.length) {
        const nombres = faltantes.slice(0, 3).map((g) => (g.nombre_es as string).toLowerCase());
        out.push({
          tipo: 'entreno',
          severidad: 'info',
          mensaje: `Llevas 2 semanas sin entrenar ${nombres.join(', ')}.`,
          data: { grupos: faltantes.map((g) => g.slug) },
        });
      }
    }
  } catch {
    // Tablas de GFIT (taxonomia / catalogo / series) pueden no existir todavia.
  }

  return out;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Habitos: racha en riesgo. Mismo patron de calculo que api/os/habitos/brief.ts
// (en_riesgo), reimplementado aqui sin importar UI: solo la logica de datos.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsHabitos(sb: SB, hoy: string): Promise<Insight[]> {
  const ayer = addDias(hoy, -1);
  const desde120 = addDias(hoy, -120);

  const { data: habitosData, error } = await sb
    .from('habitos')
    .select('id, nombre, dias_semana, created_at')
    .eq('tipo', 'diaria')
    .eq('estado', 'activo');
  if (error) throw error;
  const diarias = habitosData ?? [];
  if (!diarias.length) return [];

  const ids = diarias.map((h) => h.id as string);
  const { data: checksData, error: errChecks } = await sb
    .from('habito_checks')
    .select('habito_id, fecha')
    .in('habito_id', ids)
    .eq('signo', 'mas')
    .gte('fecha', desde120);
  if (errChecks) throw errChecks;

  const checksPorHabito = new Map<string, Set<string>>();
  for (const c of checksData ?? []) {
    const set = checksPorHabito.get(c.habito_id as string) ?? new Set<string>();
    set.add(c.fecha as string);
    checksPorHabito.set(c.habito_id as string, set);
  }

  const enRiesgo = diarias
    .filter((h) => {
      const existiaAyer = ((h.created_at as string) ?? '').slice(0, 10) <= ayer;
      if (!existiaAyer) return false;
      const fechasHechas = checksPorHabito.get(h.id as string) ?? new Set<string>();
      return falloAyer(fechasHechas, (h.dias_semana as number[]) ?? [], hoy);
    })
    .map((h) => h.nombre as string);

  if (!enRiesgo.length) return [];
  return [{
    tipo: 'habitos',
    severidad: 'nudge',
    mensaje: `Ayer fallaste ${enRiesgo.join(', ')}. Hoy no se falla dos veces.`,
    data: { habitos: enRiesgo },
  }];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Targets: promedio de kcal de los ultimos 7 dias con datos, comparado contra el
// target configurado. < 60% del target sugiere subregistro, no un deficit real.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsTargets(sb: SB, hoy: string): Promise<Insight[]> {
  const { data: config, error } = await sb
    .from('salud_config')
    .select('kcal_objetivo')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const target = (config as Record<string, unknown> | null)?.kcal_objetivo as number | undefined;
  if (!target) return [];

  const desde7 = addDias(hoy, -6);
  const { data: comidas, error: errComidas } = await sb
    .from('comidas_log')
    .select('fecha, kcal')
    .gte('fecha', desde7)
    .lte('fecha', hoy);
  if (errComidas) throw errComidas;

  const porDia = new Map<string, number>();
  for (const c of comidas ?? []) {
    if (typeof c.kcal !== 'number') continue;
    porDia.set(c.fecha as string, (porDia.get(c.fecha as string) ?? 0) + c.kcal);
  }
  if (!porDia.size) return []; // sin datos: ya lo cubre el insight de comidas

  const promedio = Array.from(porDia.values()).reduce((a, b) => a + b, 0) / porDia.size;
  if (promedio >= target * 0.6) return [];

  return [{
    tipo: 'targets',
    severidad: 'alerta',
    mensaje: `Tu promedio reciente (${Math.round(promedio)} kcal) esta muy por debajo de tu objetivo (${target} kcal). Probablemente estes subregistrando comidas, no comiendo tan poco.`,
    data: { promedio_kcal: Math.round(promedio), target_kcal: target, dias_con_datos: porDia.size },
  }];
}


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sueno: deuda acumulada (modelo de dos procesos) y falta de registro. La deuda
// se calcula con la misma logica que /api/salud/sueno/hoy, para que el coach
// y el modulo nunca digan cosas distintas.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function insightsSueno(sb: SB, hoy: string): Promise<Insight[]> {
  const desde14 = addDias(hoy, -13);
  const [resSesiones, resBio, resConfig] = await Promise.all([
    sb.from('sueno_sesiones').select('fecha, minutos').gte('fecha', desde14).lte('fecha', hoy),
    sb.from('biometricas_dia').select('fecha, sueno_min').gte('fecha', desde14).lte('fecha', hoy),
    sb.from('sueno_config').select('necesidad_h, deuda_objetivo_h').eq('id', 1).maybeSingle(),
  ]);
  if (resSesiones.error) throw resSesiones.error;

  const sesiones = resSesiones.data ?? [];
  const conSesion = new Set(sesiones.map((s) => s.fecha as string));
  const noches: NocheSueno[] = [
    ...sesiones.map((s) => ({ fecha: s.fecha as string, minutos: s.minutos as number })),
    ...(resBio.data ?? [])
      .filter((b) => b.sueno_min != null && !conSesion.has(b.fecha as string))
      .map((b) => ({ fecha: b.fecha as string, minutos: b.sueno_min as number })),
  ];

  if (!noches.length) return [];  // sin ningun dato el modulo aun no arranco

  const necesidad = Number(resConfig.data?.necesidad_h) || 8;
  const objetivo = Number(resConfig.data?.deuda_objetivo_h) || 2;
  const deuda = calcularDeuda(noches, necesidad, hoy);
  const out: Insight[] = [];

  if (deuda.horas > objetivo) {
    const severidad: Severidad = deuda.nivel === 'alta' ? 'alerta' : 'nudge';
    out.push({
      tipo: 'sueno_deuda',
      severidad,
      mensaje: `Deuda de sueno de ${formatearHoras(deuda.horas)}. El plan de hoy esta en /os/salud/sueno: se paga con 45 min mas temprano a la cama, no con una noche heroica el fin de semana.`,
      data: { deuda_h: deuda.horas, nivel: deuda.nivel, objetivo_h: objetivo, necesidad_h: necesidad },
    });
  }

  if (deuda.diasSinDato >= 5) {
    out.push({
      tipo: 'sueno_registro',
      severidad: 'nudge',
      mensaje: `${deuda.diasSinDato} de los ultimos 14 dias sin registro de sueno. Los dias sin dato cuentan como neutros, asi que la deuda real es mayor que la que ves.`,
      data: { dias_sin_dato: deuda.diasSinDato },
    });
  }

  return out;
}

// GET â†’ { generado_at, insights: [{tipo, severidad, mensaje, data}] } (maximo 6,
// alerta > nudge > info). Autorizado por cookie de sesion o X-OS-Token (n8n/cron),
// mismo patron que api/os/habitos/brief.ts. Ver docs/contrato-insights-coach.md.
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const sb = getSupabaseServer();
    const hoy = hoyGuayaquil();

    const generadores = [insightsComidas, insightsAyuno, insightsEntreno, insightsHabitos, insightsTargets, insightsSueno];
    const resultados = await Promise.all(
      generadores.map((fn) => fn(sb, hoy).catch(() => [] as Insight[])),
    );

    const insights = resultados
      .flat()
      .sort((a, b) => PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad])
      .slice(0, 6);

    return json({ generado_at: new Date().toISOString(), insights });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
