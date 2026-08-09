export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { cerrarPendientes } from '../habitos/cierre';
import { registrarEvento } from '../../../lib/juego/motor';
import { danioPorFallo, freshStart } from '../../../lib/juego/hp';
import { evaluarQuest, liquidarQuest, type ObjetivoQuest } from '../../../lib/juego/quests';
import { rachaDiaria } from '../../../lib/habitos/racha';
import { hoyLocal, addDias, diaIso } from '../../../lib/habitos/fechas';
import type { Dificultad } from '../../../lib/habitos/scoring';

type SB = ReturnType<typeof getSupabaseServer>;

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

function lunesDeSemana(fecha: string): string {
  const iso = diaIso(fecha); // 1=lunes..7=domingo
  return addDias(fecha, -(iso - 1));
}

interface FalladaDetalle {
  id: string;
  nombre: string;
  dificultad: Dificultad;
  valor: number;
  es_core: boolean;
}

// b) DaÃ±o HP: por cada dÃ­a reciÃ©n cerrado, por cada diaria fallada es_core, registra
// 'diaria_fallo' con hp negativo. Soporta resÃºmenes viejos (solo array de nombres, sin
// detalle): en ese caso no hay forma de saber es_core/dificultad, asÃ­ que se ignoran
// (comportamiento previo a este cambio: sin daÃ±o HP retroactivo).
async function aplicarDanioPorFallos(
  sb: SB,
  resumenes: Record<string, unknown>,
): Promise<number> {
  // El motor (registrarEvento) ya no zerea automaticamente el hp explicito cuando
  // hp_activo esta apagado (los toggles solo apagan la generacion DERIVADA; ver
  // comentario en lib/juego/motor.ts). Como aca el dano se calcula explicitamente
  // ANTES de llamar a registrarEvento, el chequeo del toggle tiene que vivir aca.
  const { data: jugadorRows, error: errJugador } = await sb.from('jugador').select('config').limit(1);
  if (errJugador) throw errJugador;
  const hpActivo = jugadorRows?.[0]?.config?.hp_activo !== false;
  if (!hpActivo) return 0;

  let hpPerdidoTotal = 0;
  for (const [fecha, resumenRaw] of Object.entries(resumenes)) {
    const resumen = resumenRaw as { diarias_falladas_detalle?: FalladaDetalle[] };
    const detalle = resumen.diarias_falladas_detalle ?? [];
    for (const h of detalle) {
      if (!h.es_core) continue;
      const hp = -danioPorFallo(h.dificultad, h.valor);
      const resultado = await registrarEvento(sb, {
        tipo: 'diaria_fallo',
        ref_tabla: 'habitos',
        fecha,
        hp,
        meta: { habito_id: h.id, nombre: h.nombre, dificultad: h.dificultad, valor: h.valor },
      });
      if (resultado) hpPerdidoTotal += Math.abs(hp);
    }
  }
  return hpPerdidoTotal;
}

// c) DÃ­a perfecto: por cada dÃ­a reciÃ©n cerrado marcado dia_perfecto, registra el evento
// y agenda una celebraciÃ³n peak-end (Kahneman) en Telegram ~1 min despuÃ©s.
async function celebrarDiasPerfectos(sb: SB, resumenes: Record<string, unknown>): Promise<boolean> {
  let huboDiaPerfecto = false;
  for (const [fecha, resumenRaw] of Object.entries(resumenes)) {
    const resumen = resumenRaw as { dia_perfecto?: boolean };
    if (!resumen.dia_perfecto) continue;
    huboDiaPerfecto = true;
    await registrarEvento(sb, { tipo: 'dia_perfecto', fecha, meta: { fecha } }).catch(() => null);

    const recordarAt = new Date(Date.now() + 60 * 1000);
    await sb.from('recordatorios').insert([{
      mensaje: 'DÃ­a perfecto ayer: ninguna diaria fallÃ³. Que se sienta ese impulso hoy tambiÃ©n.',
      recordar_at: recordarAt.toISOString(),
      canal: 'telegram',
    }]);
  }
  return huboDiaPerfecto;
}

// e) Ayuno: nudge manual-first (Fase 5 Salud OS). Por cada dÃ­a reciÃ©n cerrado, si nadie
// tocÃ³ el mÃ³dulo de ayuno ese dÃ­a (ni iniciÃ³ ni cerrÃ³ uno) y hay un protocolo configurado
// en salud_config, agenda un recordatorio de Telegram preguntando el estado. NUNCA abre
// ni cierra un ayuno por su cuenta, solo pregunta. Idempotente por dÃ­a: el mensaje incluye
// la fecha, asÃ­ que un segundo intento del mismo dÃ­a no duplica el recordatorio.
async function sugerirAyunoSinRegistro(sb: SB, cerrados: string[]): Promise<number> {
  if (!cerrados.length) return 0;

  const { data: configRows, error: errConfig } = await sb
    .from('salud_config')
    .select('protocolo_ayuno_default')
    .order('created_at', { ascending: true })
    .limit(1);
  if (errConfig) throw errConfig;
  // Columna existente (not null, default '16_8'): si no hay fila de config todavÃ­a,
  // no hay mÃ³dulo de salud activo y no se sugiere nada.
  const protocolo = configRows?.[0]?.protocolo_ayuno_default;
  if (!protocolo) return 0;

  let sugeridos = 0;
  for (const dia of cerrados) {
    const inicioDia = `${dia}T00:00:00-05:00`;
    const inicioSiguiente = `${addDias(dia, 1)}T00:00:00-05:00`;

    const { data: tocados, error: errTocados } = await sb
      .from('ayunos')
      .select('id')
      .or(
        `and(inicio.gte.${inicioDia},inicio.lt.${inicioSiguiente}),` +
        `and(fin.gte.${inicioDia},fin.lt.${inicioSiguiente})`,
      )
      .limit(1);
    if (errTocados) throw errTocados;
    if (tocados && tocados.length) continue; // hubo actividad de ayuno ese dÃ­a

    const mensaje = `Â¿Sigues comiendo o ya estÃ¡s ayunando? No se registrÃ³ tu estado de ayuno el ${dia}.`;
    const { data: yaExiste, error: errYa } = await sb
      .from('recordatorios')
      .select('id')
      .eq('mensaje', mensaje)
      .limit(1);
    if (errYa) throw errYa;
    if (yaExiste && yaExiste.length) continue;

    await sb.from('recordatorios').insert([{
      mensaje,
      recordar_at: new Date(Date.now() + 60 * 1000).toISOString(),
      canal: 'telegram',
    }]);
    sugeridos += 1;
  }
  return sugeridos;
}

// d) Fresh start de lunes: resuelve las quests de la semana pasada, resetea HP al mÃ¡ximo,
// y agenda el resumen semanal a Telegram. Idempotente: siembra un evento 'ajuste' con
// meta.fresh_start_semana = lunes de hoy, y no repite si ya existe.
async function procesarLunes(
  sb: SB,
  hoy: string,
): Promise<{ questsResueltas: number; resumenEnviado: boolean } | null> {
  if (diaIso(hoy) !== 1) return null;

  const lunesHoy = lunesDeSemana(hoy);
  const { data: yaHecho, error: errYaHecho } = await sb
    .from('xp_events')
    .select('id')
    .eq('tipo', 'ajuste')
    .eq('meta->>fresh_start_semana', lunesHoy)
    .limit(1)
    .maybeSingle();
  if (errYaHecho) throw errYaHecho;
  if (yaHecho) return null;

  await sb.from('xp_events').insert([{
    tipo: 'ajuste',
    xp: 0,
    oro: 0,
    hp: 0,
    fecha: hoy,
    meta: { fresh_start_semana: lunesHoy },
  }]);

  const semanaPasadaInicio = addDias(lunesHoy, -7);
  const semanaPasadaFin = addDias(lunesHoy, -1);

  // Resolver quests de la semana pasada.
  const { data: quests, error: errQuests } = await sb
    .from('quests')
    .select('*')
    .eq('estado', 'activa')
    .eq('semana_inicio', semanaPasadaInicio);
  if (errQuests) throw errQuests;

  const { data: eventosSemanaData, error: errEventos } = await sb
    .from('xp_events')
    .select('tipo, fecha')
    .gte('fecha', semanaPasadaInicio)
    .lte('fecha', semanaPasadaFin);
  if (errEventos) throw errEventos;

  const { data: checksSemanaData, error: errChecks } = await sb
    .from('habito_checks')
    .select('habito_id, fecha')
    .gte('fecha', semanaPasadaInicio)
    .lte('fecha', semanaPasadaFin);
  if (errChecks) throw errChecks;

  let questsResueltas = 0;
  for (const quest of quests ?? []) {
    const objetivo = quest.objetivo as ObjetivoQuest;
    const evaluacion = evaluarQuest(objetivo, eventosSemanaData ?? [], checksSemanaData ?? []);
    const cumplida = evaluacion.estado === 'cumplida';
    const liquidacion = liquidarQuest(
      { apuesta_oro: quest.apuesta_oro ?? 0, premio_xp: quest.premio_xp ?? 0, premio_oro: quest.premio_oro ?? 0 },
      cumplida,
    );

    await registrarEvento(sb, {
      tipo: cumplida ? 'quest_ganada' : 'quest_perdida',
      xp: liquidacion.xpDelta,
      oro: liquidacion.oroDelta,
      fecha: hoy,
      meta: { quest_id: quest.id, titulo: quest.titulo },
    }).catch(() => null);

    await sb
      .from('quests')
      .update({ estado: cumplida ? 'ganada' : 'perdida', updated_at: new Date().toISOString() })
      .eq('id', quest.id);
    questsResueltas += 1;
  }

  // Fresh start HP (Milkman): resetea al mÃ¡ximo.
  const { data: jugadorRows, error: errJugador } = await sb
    .from('jugador')
    .select('id, hp_max')
    .limit(1);
  if (errJugador) throw errJugador;
  const jugador = jugadorRows?.[0];
  if (jugador) {
    await sb
      .from('jugador')
      .update({ hp: freshStart(jugador.hp_max ?? 50), updated_at: new Date().toISOString() })
      .eq('id', jugador.id);
  }

  // Resumen semanal (peak-end): XP ganado la semana pasada + mejor racha actual + resultado
  // de quests, agendado para el daily brief de Telegram.
  const { data: xpEventosConMonto, error: errXpMonto } = await sb
    .from('xp_events')
    .select('xp')
    .gte('fecha', semanaPasadaInicio)
    .lte('fecha', semanaPasadaFin);
  if (errXpMonto) throw errXpMonto;
  const xpTotalSemana = (xpEventosConMonto ?? []).reduce((acc: number, e: any) => acc + (e.xp ?? 0), 0);

  const { data: diariasActivas, error: errDiarias } = await sb
    .from('habitos')
    .select('id, dias_semana')
    .eq('tipo', 'diaria')
    .eq('estado', 'activo');
  if (errDiarias) throw errDiarias;

  let mejorRachaActual = 0;
  if (diariasActivas?.length) {
    const ids = diariasActivas.map((h: any) => h.id);
    const { data: checksTodos, error: errChecksTodos } = await sb
      .from('habito_checks')
      .select('habito_id, fecha')
      .in('habito_id', ids)
      .eq('signo', 'mas');
    if (errChecksTodos) throw errChecksTodos;

    for (const h of diariasActivas) {
      const fechasHechas = new Set(
        (checksTodos ?? []).filter((c: any) => c.habito_id === h.id).map((c: any) => c.fecha),
      );
      const racha = rachaDiaria(fechasHechas, h.dias_semana ?? [], hoy);
      if (racha.actual > mejorRachaActual) mejorRachaActual = racha.actual;
    }
  }

  const questsGanadas = questsResueltas > 0
    ? (await sb.from('quests').select('id').eq('estado', 'ganada').eq('semana_inicio', semanaPasadaInicio)).data?.length ?? 0
    : 0;

  const mensaje = [
    'Resumen semanal:',
    `XP ganado: ${xpTotalSemana}.`,
    `Mejor racha activa: ${mejorRachaActual} dÃ­as.`,
    questsResueltas > 0
      ? `Quests: ${questsGanadas}/${questsResueltas} ganadas.`
      : 'Sin quests la semana pasada.',
  ].join(' ');

  await sb.from('recordatorios').insert([{
    mensaje,
    recordar_at: new Date(Date.now() + 60 * 1000).toISOString(),
    canal: 'telegram',
  }]);

  return { questsResueltas, resumenEnviado: true };
}

// POST: orquesta el cierre nocturno completo (habitos + daÃ±o HP + dÃ­a perfecto + fresh
// start de lunes). Autorizado por cookie de sesiÃ³n (Pancho) o X-OS-Token (n8n, 00:05
// Guayaquil, corre despuÃ©s del cierre de habitos/cierre.ts o lo dispara Ã©l mismo).
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const sb = getSupabaseServer();

    const { cerrados, resumenes } = await cerrarPendientes(sb);
    const hpPerdido = await aplicarDanioPorFallos(sb, resumenes);
    const diaPerfecto = await celebrarDiasPerfectos(sb, resumenes);
    const ayunosSugeridos = await sugerirAyunoSinRegistro(sb, cerrados);

    const hoy = hoyLocal();
    const lunes = await procesarLunes(sb, hoy);

    return json({
      ok: true,
      cerrados,
      hpPerdido,
      diaPerfecto,
      ayunosSugeridos,
      ...(lunes ? { lunes } : {}),
    });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
