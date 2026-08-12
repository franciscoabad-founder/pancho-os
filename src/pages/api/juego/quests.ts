export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { registrarEvento } from '../../../lib/juego/motor';
import { evaluarQuest, type ObjetivoQuest } from '../../../lib/juego/quests';
import { hoyLocal, addDias, diaIso } from '../../../lib/habitos/fechas';

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// Lunes (YYYY-MM-DD) de la semana que contiene `fecha`, en la zona de Guayaquil.
function lunesDeSemana(fecha: string): string {
  const iso = diaIso(fecha); // 1=lunes..7=domingo
  return addDias(fecha, -(iso - 1));
}

// GET: quest(s) de la semana actual + historial de las últimas 8 (cualquier estado).
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const semanaActual = lunesDeSemana(hoyLocal());

    const { data: actuales, error: errActuales } = await sb
      .from('quests')
      .select('*')
      .eq('semana_inicio', semanaActual)
      .order('created_at', { ascending: false });
    if (errActuales) throw errActuales;

    const { data: historial, error: errHistorial } = await sb
      .from('quests')
      .select('*')
      .order('semana_inicio', { ascending: false })
      .limit(8);
    if (errHistorial) throw errHistorial;

    // Progreso de las quests activas de la semana en curso: mismo patron que
    // procesarLunes en api/os/juego/cierre.ts (una query de xp_events y una de
    // habito_checks para toda la semana, no por quest).
    const questsActivas = actuales?.filter((q: any) => q.estado === 'activa') ?? [];
    let quests = actuales ?? [];
    if (questsActivas.length > 0) {
      const finSemana = addDias(semanaActual, 6);
      const { data: eventosSemanaData, error: errEventos } = await sb
        .from('xp_events')
        .select('tipo, fecha')
        .gte('fecha', semanaActual)
        .lte('fecha', finSemana);
      if (errEventos) throw errEventos;

      const { data: checksSemanaData, error: errChecks } = await sb
        .from('habito_checks')
        .select('habito_id, fecha')
        .gte('fecha', semanaActual)
        .lte('fecha', finSemana);
      if (errChecks) throw errChecks;

      quests = (actuales ?? []).map((q: any) => {
        if (q.estado !== 'activa') return q;
        const evaluacion = evaluarQuest(
          q.objetivo as ObjetivoQuest,
          eventosSemanaData ?? [],
          checksSemanaData ?? [],
        );
        return { ...q, progreso: { estado: evaluacion.estado, progreso: evaluacion.progreso, meta: evaluacion.meta } };
      });
    }

    return json({ semanaActual, quests, historial: historial ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// POST {titulo, objetivo, apuesta_oro?, premio_xp?, premio_oro?}: crea una quest para la
// semana en curso (semana_inicio = lunes de hoy, Guayaquil). Si apuesta_oro > 0, valida oro
// suficiente (409 si no alcanza) y descuenta con un evento 'ajuste' (oro negativo).
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.titulo?.trim()) return json({ error: 'titulo requerido' }, 400);
    if (!body.objetivo || typeof body.objetivo !== 'object') {
      return json({ error: 'objetivo requerido' }, 400);
    }

    const apuestaOro = Number(body.apuesta_oro ?? 0);
    const premioXp = Number(body.premio_xp ?? 0);
    const premioOro = Number(body.premio_oro ?? 0);
    if (!Number.isFinite(apuestaOro) || apuestaOro < 0) return json({ error: 'apuesta_oro inválida' }, 400);
    if (!Number.isFinite(premioXp) || premioXp < 0) return json({ error: 'premio_xp inválido' }, 400);
    if (!Number.isFinite(premioOro) || premioOro < 0) return json({ error: 'premio_oro inválido' }, 400);

    const sb = getSupabaseServer();

    if (apuestaOro > 0) {
      const { data: jugadorRows, error: errJugador } = await sb
        .from('jugador')
        .select('id, oro')
        .limit(1);
      if (errJugador) throw errJugador;
      const jugador = jugadorRows?.[0];
      if (!jugador) return json({ error: 'jugador no encontrado' }, 404);
      if ((jugador.oro ?? 0) < apuestaOro) {
        return json({ error: 'oro insuficiente para la apuesta', faltan: apuestaOro - (jugador.oro ?? 0) }, 409);
      }
    }

    // El front (OSJuego.tsx) manda tipo:'evento'; evaluarQuest reconoce 'conteo_eventos'.
    // Se normaliza aqui al guardar para que el dato en Supabase quede canonico.
    const objetivo = body.objetivo.tipo === 'evento'
      ? { ...body.objetivo, tipo: 'conteo_eventos' }
      : body.objetivo;

    const semanaInicio = lunesDeSemana(hoyLocal());
    const { data: quest, error: errQuest } = await sb
      .from('quests')
      .insert([{
        titulo: body.titulo.trim(),
        objetivo,
        apuesta_oro: Math.round(apuestaOro),
        premio_xp: Math.round(premioXp),
        premio_oro: Math.round(premioOro),
        semana_inicio: semanaInicio,
      }])
      .select()
      .single();
    if (errQuest) throw errQuest;

    if (apuestaOro > 0) {
      await registrarEvento(sb, {
        tipo: 'ajuste',
        xp: 0,
        oro: -Math.round(apuestaOro),
        meta: { quest_apuesta: quest.id },
      }).catch(() => null);
    }

    return json({ ok: true, quest }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// PATCH ?id= {accion:'cancelar'}: cancela una quest activa y devuelve la apuesta (evento
// 'ajuste' positivo). Solo permitido mientras estado='activa'.
export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const id = context.url.searchParams.get('id');
    if (!id) return json({ error: 'id requerido' }, 400);
    const body = await context.request.json();
    if (body.accion !== 'cancelar') return json({ error: 'acción no soportada' }, 400);

    const sb = getSupabaseServer();
    const { data: quest, error: errQuest } = await sb
      .from('quests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errQuest) throw errQuest;
    if (!quest) return json({ error: 'quest no encontrada' }, 404);
    if (quest.estado !== 'activa') return json({ error: 'solo se puede cancelar una quest activa' }, 400);

    const { data: actualizada, error: errUpdate } = await sb
      .from('quests')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (errUpdate) throw errUpdate;

    if ((quest.apuesta_oro ?? 0) > 0) {
      await registrarEvento(sb, {
        tipo: 'ajuste',
        xp: 0,
        oro: quest.apuesta_oro,
        meta: { quest_cancelada: id },
      }).catch(() => null);
    }

    return json({ ok: true, quest: actualizada });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
