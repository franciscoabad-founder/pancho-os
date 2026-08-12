export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { hoyLocal } from '../../../lib/habitos/fechas';
import { nuevoValor, recompensaCheck, type Dificultad } from '../../../lib/habitos/scoring';
import { rachaDiaria } from '../../../lib/habitos/racha';
import { nivelDesdeXp } from '../../../lib/juego/nivel';
import { registrarEvento } from '../../../lib/juego/motor';

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// Valida 'YYYY-MM-DD' como fecha calendario real (rechaza p.ej. 2026-02-30).
function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// POST {habito_id, signo?='mas', fecha?}: registra un check, calcula recompensa con la
// lib pura, actualiza el valor cache del hábito y el xp_total del perfil.
// Respuesta 201: { ok, xp, oro, valor, racha, nivel, subioNivel }.
//   racha solo se calcula para 'diaria' (null en hábitos +/-).
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.habito_id) return json({ error: 'habito_id requerido' }, 400);

    if (body.signo !== undefined && body.signo !== 'mas' && body.signo !== 'menos') {
      return json({ error: 'signo debe ser mas o menos' }, 400);
    }
    const signo: 'mas' | 'menos' = body.signo === 'menos' ? 'menos' : 'mas';

    let fecha = hoyLocal();
    if (body.fecha !== undefined && body.fecha !== null && body.fecha !== '') {
      const f = body.fecha.toString();
      if (!esFechaValida(f)) return json({ error: 'fecha inválida, use formato YYYY-MM-DD' }, 400);
      fecha = f;
    }
    if (fecha > hoyLocal()) return json({ error: 'no se puede registrar una fecha futura' }, 400);

    const sb = getSupabaseServer();
    const { data: habito, error: errHabito } = await sb
      .from('habitos')
      .select('*')
      .eq('id', body.habito_id)
      .maybeSingle();
    if (errHabito) throw errHabito;
    if (!habito || habito.estado === 'archivado') return json({ error: 'hábito no encontrado' }, 404);

    if (habito.tipo === 'diaria') {
      if (signo === 'menos') return json({ error: 'las diarias solo aceptan signo mas' }, 400);
      const { data: existente, error: errExiste } = await sb
        .from('habito_checks')
        .select('id')
        .eq('habito_id', habito.id)
        .eq('fecha', fecha)
        .maybeSingle();
      if (errExiste) throw errExiste;
      if (existente) return json({ error: 'ya registrado hoy' }, 409);
    } else {
      if (signo === 'mas' && !habito.permite_mas) {
        return json({ error: 'este hábito no permite signo mas' }, 400);
      }
      if (signo === 'menos' && !habito.permite_menos) {
        return json({ error: 'este hábito no permite signo menos' }, 400);
      }
    }

    const dificultad = habito.dificultad as Dificultad;
    const valorActual = habito.valor ?? 0;
    const valorNuevo = nuevoValor(valorActual, signo, dificultad);
    const recompensa = signo === 'mas' ? recompensaCheck(valorActual, dificultad) : { xp: 0, oro: 0 };

    const { data: checkInsertado, error: errCheck } = await sb.from('habito_checks').insert([{
      habito_id: habito.id,
      fecha,
      signo,
      valor_despues: valorNuevo,
      xp: recompensa.xp,
      oro: recompensa.oro,
      source: 'manual',
    }]).select().single();
    if (errCheck) throw errCheck;

    const { error: errUpdateHabito } = await sb
      .from('habitos')
      .update({ valor: valorNuevo, updated_at: new Date().toISOString() })
      .eq('id', habito.id);
    if (errUpdateHabito) throw errUpdateHabito;

    // Motor transversal (Version B): registra el evento gamificable y devuelve el
    // estado agregado (xp/oro/nivel) a través de `jugador`. Si el motor no puede
    // operar (tabla `jugador` aún no migrada), cae de vuelta a `habitos_perfil`
    // para no romper la rama A mientras B no se ha aplicado en Supabase.
    const tipoEvento = habito.tipo === 'diaria' ? 'diaria_check' : 'habito_check';
    let resultadoMotor: Awaited<ReturnType<typeof registrarEvento>> = null;
    try {
      resultadoMotor = await registrarEvento(sb, {
        tipo: tipoEvento,
        ref_tabla: 'habito_checks',
        ref_id: checkInsertado?.id,
        fecha,
        meta: { dificultad, valor: valorActual },
        xp: recompensa.xp,
        oro: recompensa.oro,
      });
    } catch {
      resultadoMotor = null;
    }

    let nivelDespues: ReturnType<typeof nivelDesdeXp>;
    let subioNivel: boolean;

    if (resultadoMotor) {
      // El motor ya actualizó `jugador`; releemos xp_total para armar el NivelInfo
      // completo (xpEnNivel/xpSiguiente/progreso) que la UI espera.
      const { data: jugadorFila } = await sb.from('jugador').select('xp_total').limit(1).maybeSingle();
      nivelDespues = nivelDesdeXp(jugadorFila?.xp_total ?? 0);
      subioNivel = resultadoMotor.subioNivel;
    } else {
      // Fallback: motor no disponible (tabla `jugador` aún no migrada). Mantiene el
      // comportamiento previo escribiendo en `habitos_perfil` directamente.
      const { data: perfil, error: errPerfil } = await sb
        .from('habitos_perfil')
        .select('id, xp_total')
        .limit(1)
        .maybeSingle();
      if (errPerfil) throw errPerfil;

      const xpAntes = perfil?.xp_total ?? 0;
      const xpDespues = xpAntes + recompensa.xp;
      if (perfil?.id) {
        const { error: errUpdatePerfil } = await sb
          .from('habitos_perfil')
          .update({ xp_total: xpDespues, updated_at: new Date().toISOString() })
          .eq('id', perfil.id);
        if (errUpdatePerfil) throw errUpdatePerfil;
      }
      const nivelAntesFallback = nivelDesdeXp(xpAntes);
      nivelDespues = nivelDesdeXp(xpDespues);
      subioNivel = nivelDespues.nivel > nivelAntesFallback.nivel;
    }

    let racha = null;
    if (habito.tipo === 'diaria') {
      const { data: checksHabito, error: errChecks } = await sb
        .from('habito_checks')
        .select('fecha')
        .eq('habito_id', habito.id)
        .eq('signo', 'mas');
      if (errChecks) throw errChecks;
      const fechasHechas = new Set((checksHabito ?? []).map((c) => c.fecha));
      racha = rachaDiaria(fechasHechas, habito.dias_semana ?? [], hoyLocal());
    }

    return json({
      ok: true,
      xp: recompensa.xp,
      oro: recompensa.oro,
      valor: valorNuevo,
      racha,
      nivel: nivelDespues,
      subioNivel,
    }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// DELETE {habito_id, fecha} (body o query): deshace el ÚLTIMO check de ese hábito+fecha.
// Solo se permite deshacer el día de hoy (protege el ledger histórico).
export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    let habitoId = context.url.searchParams.get('habito_id');
    let fecha = context.url.searchParams.get('fecha');
    if (!habitoId || !fecha) {
      try {
        const body = await context.request.json();
        habitoId = habitoId || body?.habito_id;
        fecha = fecha || body?.fecha;
      } catch {
        // sin body JSON: se resuelve solo con query params.
      }
    }
    if (!habitoId || !fecha) return json({ error: 'habito_id y fecha requeridos' }, 400);

    const hoy = hoyLocal();
    if (fecha !== hoy) return json({ error: 'solo se puede deshacer el check de hoy' }, 400);

    const sb = getSupabaseServer();
    const { data: ultimo, error: errUltimo } = await sb
      .from('habito_checks')
      .select('*')
      .eq('habito_id', habitoId)
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errUltimo) throw errUltimo;
    if (!ultimo) return json({ error: 'no hay check para deshacer' }, 404);

    const { error: errDelete } = await sb.from('habito_checks').delete().eq('id', ultimo.id);
    if (errDelete) throw errDelete;

    // Reversión del valor: `habitos.valor` es un acumulado de TODA la vida del hábito
    // (no reinicia por día), así que el valor correcto tras deshacer es el valor_despues
    // del check inmediatamente anterior en el tiempo (de cualquier fecha), o 0 si el check
    // borrado era el primero que existía para este hábito.
    const { data: anterior, error: errAnterior } = await sb
      .from('habito_checks')
      .select('valor_despues')
      .eq('habito_id', habitoId)
      .lt('created_at', ultimo.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errAnterior) throw errAnterior;
    const valorRevertido = anterior?.valor_despues ?? 0;

    const { error: errUpdateHabito } = await sb
      .from('habitos')
      .update({ valor: valorRevertido, updated_at: new Date().toISOString() })
      .eq('id', habitoId);
    if (errUpdateHabito) throw errUpdateHabito;

    // Motor transversal: revierte el xp/oro otorgado con un evento 'ajuste' negativo
    // en vez de tocar habitos_perfil directamente. ref_id null (el check.id borrado
    // no sirve por la unicidad tipo+ref_id), la referencia queda en meta.
    let revertidoPorMotor = false;
    try {
      const resultado = await registrarEvento(sb, {
        tipo: 'ajuste',
        xp: -(ultimo.xp ?? 0),
        oro: -(ultimo.oro ?? 0),
        meta: { revierte_check: ultimo.id },
      });
      revertidoPorMotor = resultado != null;
    } catch {
      revertidoPorMotor = false;
    }

    if (!revertidoPorMotor) {
      const { data: perfil, error: errPerfil } = await sb
        .from('habitos_perfil')
        .select('id, xp_total')
        .limit(1)
        .maybeSingle();
      if (errPerfil) throw errPerfil;
      if (perfil?.id) {
        const { error: errUpdatePerfil } = await sb
          .from('habitos_perfil')
          .update({ xp_total: (perfil.xp_total ?? 0) - (ultimo.xp ?? 0), updated_at: new Date().toISOString() })
          .eq('id', perfil.id);
        if (errUpdatePerfil) throw errUpdatePerfil;
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
