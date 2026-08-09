// Motor transversal de gamificacion (Version B): unico modulo con IO de lib/juego.
// Fire-and-forget: los call sites lo invocan con `.catch(() => null)` tras el insert
// exitoso del endpoint; si el motor falla, el endpoint ya respondio igual. NO testeado
// con node:test (requiere Supabase); la logica pura que usa (recompensas/hp/loot/nivel)
// si esta cubierta.

import { nivelDesdeXp } from './nivel.ts';
import { recompensaPorEvento, type TipoEvento, type RecompensaMeta } from './recompensas.ts';
import { danioPorFallo, aplicarMuerte } from './hp.ts';
import { tirarLoot, type Loot } from './loot.ts';
import { hoyLocal } from '../habitos/fechas.ts';
import type { Dificultad } from '../habitos/scoring.ts';

export interface EventoEntrada {
  tipo: TipoEvento;
  ref_tabla?: string;
  ref_id?: string;
  fecha?: string;
  meta?: RecompensaMeta & Record<string, unknown>;
  /** xp/oro/hp explicitos: usados cuando el llamador ya calculo el monto (compra,
   * ajuste, muerte, loot, quest_*) en vez de derivarlo de recompensaPorEvento. */
  xp?: number;
  oro?: number;
  hp?: number;
}

export interface ResultadoEvento {
  xp: number;
  oro: number;
  hp: number;
  nivel: number;
  subioNivel: boolean;
  loot?: Loot;
  muerte?: { oroPerdido: number };
}

interface JugadorRow {
  id: string;
  xp_total: number;
  oro: number;
  hp: number;
  hp_max: number;
  config: { hp_activo?: boolean; oro_activo?: boolean; loot_activo?: boolean };
}

// Tipos minimos de cliente Supabase que el motor necesita (evita atar la lib a
// @supabase/supabase-js como dependencia directa de tipos).
interface SupabaseLike {
  from: (tabla: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
}

/**
 * Registra un evento gamificable: calcula xp/oro (salvo que vengan explicitos),
 * inserta en xp_events (idempotente via unique parcial tipo+ref_id), tira loot,
 * aplica dano/muerte si corresponde, y actualiza el estado agregado de `jugador`.
 * Devuelve null si el evento ya habia sido otorgado (colision de unique).
 */
export async function registrarEvento(
  sb: SupabaseLike,
  ev: EventoEntrada,
  rng: () => number = Math.random,
): Promise<ResultadoEvento | null> {
  const { data: jugadorRows, error: errJugador } = await sb
    .from('jugador')
    .select('id, xp_total, oro, hp, hp_max, config')
    .limit(1);
  if (errJugador || !jugadorRows || jugadorRows.length === 0) return null;

  const jugador = jugadorRows[0] as JugadorRow;
  const config = jugador.config ?? {};
  const hpActivo = config.hp_activo !== false;
  const oroActivo = config.oro_activo !== false;
  const lootActivo = config.loot_activo !== false;

  const meta = ev.meta ?? {};
  const calculado = recompensaPorEvento(ev.tipo, meta);
  const oroExplicito = ev.oro !== undefined;
  const hpExplicito = ev.hp !== undefined;
  let xp = ev.xp ?? calculado.xp;
  let oro = ev.oro ?? calculado.oro;
  // Regla: los toggles (hp_activo/oro_activo) apagan la GENERACION derivada
  // (recompensaPorEvento, dano de diaria_fallo calculado aqui mismo), no la
  // contabilidad explicita que ya trae el evento (compras, ajustes, liquidacion de
  // quests, dano ya calculado por el cierre). Si el llamador decidio el monto, se
  // respeta aunque el toggle este apagado; el llamador es quien debe chequear el
  // toggle antes de mandarlo si corresponde (ver aplicarDanioPorFallos en cierre.ts).
  if (!oroActivo && !oroExplicito) oro = 0;

  let hpDelta = ev.hp ?? 0;
  if ((ev.tipo === 'diaria_fallo') && hpActivo && !hpExplicito && hpDelta === 0) {
    const dificultad = (meta.dificultad ?? 'facil') as Dificultad;
    const valor = meta.valor ?? 0;
    hpDelta = -danioPorFallo(dificultad, valor);
  }
  if (!hpActivo && !hpExplicito) hpDelta = 0;

  const fecha = ev.fecha ?? hoyLocal();

  const { error: errInsert } = await sb.from('xp_events').insert({
    tipo: ev.tipo,
    ref_tabla: ev.ref_tabla ?? null,
    ref_id: ev.ref_id ?? null,
    xp,
    oro,
    hp: hpDelta,
    fecha,
    meta,
  });

  if (errInsert) {
    // 23505 = violacion de unique (tipo, ref_id): el evento ya fue otorgado antes.
    if ((errInsert as { code?: string }).code === '23505') return null;
    return null;
  }

  let loot: Loot | undefined;
  if (lootActivo && ev.tipo !== 'loot') {
    const racha = typeof meta.valor === 'number' ? meta.valor : 0;
    const tirada = tirarLoot(rng, { racha });
    if (tirada) {
      loot = tirada;
      oro += tirada.oro;
      await sb.from('xp_events').insert({
        tipo: 'loot',
        xp: 0,
        oro: tirada.oro,
        hp: 0,
        fecha,
        meta: { mensaje: tirada.mensaje },
      });
    }
  }

  const nivelAntes = nivelDesdeXp(jugador.xp_total).nivel;
  let hpNuevo: number;
  let oroTotal: number;
  let xpTotalNuevo: number;
  let muerte: ResultadoEvento['muerte'];

  // Aplica el incremento de forma atomica via RPC (evita el lost update de leer
  // jugador -> calcular en JS -> update absoluto, si dos eventos llegan casi a la
  // vez). Fallback al camino viejo (select + update absoluto) ante CUALQUIER error
  // de la RPC (funcion inexistente, PGRST202 por cache de PostgREST desactualizado,
  // etc.), para nunca dejar el ledger de xp_events divergido del cache de jugador.
  const { data: filasIncrementadas, error: errIncrementar } = await sb.rpc('juego_incrementar', {
    p_xp: xp,
    p_oro: oro,
    p_hp: hpDelta,
  });

  // Maneja la muerte (hp <= 0) de forma consistente sin importar el camino tomado.
  const manejarMuerte = async (oroActual: number): Promise<{ oroTotal: number; hpNuevo: number }> => {
    const { oroPerdido, hpNuevo: hpRestaurado } = aplicarMuerte(oroActual, jugador.hp_max);
    muerte = { oroPerdido };
    await sb.from('xp_events').insert({
      tipo: 'muerte',
      xp: 0,
      oro: -oroPerdido,
      hp: 0,
      fecha,
      meta: {},
    });
    return { oroTotal: Math.max(0, oroActual - oroPerdido), hpNuevo: hpRestaurado };
  };

  if (!errIncrementar) {
    const filaNueva = Array.isArray(filasIncrementadas) ? filasIncrementadas[0] : filasIncrementadas;
    hpNuevo = filaNueva.hp;
    oroTotal = filaNueva.oro;
    xpTotalNuevo = filaNueva.xp_total;

    if (hpNuevo <= 0 && hpActivo) {
      // Calcula el oro perdido antes de registrar el evento (manejarMuerte ya inserta
      // el evento 'muerte'), luego aplica el ajuste via RPC para mantener el update
      // atomico en este camino.
      const oroAntes = oroTotal;
      const resultado = await manejarMuerte(oroAntes);
      const oroPerdido = oroAntes - resultado.oroTotal;
      const { data: filasMuerte } = await sb.rpc('juego_incrementar', {
        p_xp: 0,
        p_oro: -oroPerdido,
        p_hp: jugador.hp_max,
      });
      const filaMuerte = Array.isArray(filasMuerte) ? filasMuerte[0] : filasMuerte;
      oroTotal = filaMuerte ? filaMuerte.oro : resultado.oroTotal;
      hpNuevo = filaMuerte ? filaMuerte.hp : resultado.hpNuevo;
    }
  } else {
    // Fallback (RPC fallo por cualquier motivo): select + update absoluto, como antes.
    hpNuevo = Math.min(jugador.hp_max, Math.max(0, jugador.hp + hpDelta));
    oroTotal = jugador.oro + oro;
    xpTotalNuevo = jugador.xp_total + xp;

    if (hpNuevo <= 0 && hpActivo) {
      const resultado = await manejarMuerte(oroTotal);
      oroTotal = resultado.oroTotal;
      hpNuevo = resultado.hpNuevo;
    }

    await sb
      .from('jugador')
      .update({ xp_total: xpTotalNuevo, oro: oroTotal, hp: hpNuevo, updated_at: new Date().toISOString() })
      .eq('id', jugador.id);
  }

  const nivelInfo = nivelDesdeXp(xpTotalNuevo);

  return {
    xp,
    oro,
    hp: hpNuevo,
    nivel: nivelInfo.nivel,
    subioNivel: nivelInfo.nivel > nivelAntes,
    loot,
    muerte,
  };
}
