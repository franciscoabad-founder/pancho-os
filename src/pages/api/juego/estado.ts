export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { hoyLocal } from '../../../lib/habitos/fechas';
import { nivelDesdeXp } from '../../../lib/juego/nivel';

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// GET: jugador (fila Ãºnica) + nivel derivado + eventos de hoy (suma xp/oro) + quests activas.
// Contrato: { jugador: {...fila, nivel}, eventosHoy: { xp, oro, conteo }, quests: [...] }
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();

    const { data: jugadorRows, error: errJugador } = await sb
      .from('jugador')
      .select('*')
      .limit(1);
    if (errJugador) throw errJugador;
    const jugador = jugadorRows?.[0] ?? null;
    if (!jugador) return json({ jugador: null, eventosHoy: { xp: 0, oro: 0, conteo: 0 }, quests: [] });

    const hoy = hoyLocal();
    const { data: eventosHoyData, error: errEventos } = await sb
      .from('xp_events')
      .select('xp, oro')
      .eq('fecha', hoy);
    if (errEventos) throw errEventos;

    const eventosHoy = (eventosHoyData ?? []).reduce(
      (acc, e) => ({ xp: acc.xp + (e.xp ?? 0), oro: acc.oro + (e.oro ?? 0), conteo: acc.conteo + 1 }),
      { xp: 0, oro: 0, conteo: 0 },
    );

    const { data: quests, error: errQuests } = await sb
      .from('quests')
      .select('*')
      .eq('estado', 'activa')
      .order('semana_inicio', { ascending: false });
    if (errQuests) throw errQuests;

    return json({
      jugador: { ...jugador, nivel: nivelDesdeXp(jugador.xp_total ?? 0) },
      eventosHoy,
      quests: quests ?? [],
    });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// PATCH: merge de config (hp_activo/oro_activo/loot_activo booleanos). No pisa claves
// que no vienen en el body.
export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const claves = ['hp_activo', 'oro_activo', 'loot_activo'] as const;
    const cambios: Record<string, boolean> = {};
    for (const clave of claves) {
      if (clave in body) {
        if (typeof body[clave] !== 'boolean') {
          return json({ error: `${clave} debe ser booleano` }, 400);
        }
        cambios[clave] = body[clave];
      }
    }
    if (!Object.keys(cambios).length) return json({ error: 'sin campos para actualizar' }, 400);

    const sb = getSupabaseServer();
    const { data: jugadorRows, error: errJugador } = await sb
      .from('jugador')
      .select('id, config')
      .limit(1);
    if (errJugador) throw errJugador;
    const jugador = jugadorRows?.[0];
    if (!jugador) return json({ error: 'jugador no encontrado' }, 404);

    const configNueva = { ...(jugador.config ?? {}), ...cambios };
    const { data, error } = await sb
      .from('jugador')
      .update({ config: configNueva, updated_at: new Date().toISOString() })
      .eq('id', jugador.id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, jugador: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
