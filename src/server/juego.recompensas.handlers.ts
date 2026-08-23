// Logica de /api/juego/recompensas, portada de src/pages/api/juego/recompensas.ts
// (Astro). Tienda de recompensas y canje contra el oro del jugador.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { json } from './osAuth.ts';
import { registrarEvento } from '../lib/juego/motor.ts';

const ESTADOS = ['activa', 'pausada', 'archivada'];

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

// GET: tienda de recompensas (activas + pausadas; las archivadas quedan fuera del listado
// normal, siguen existiendo en DB por historial de veces_canjeada).
export async function listarRecompensas(): Promise<Response> {
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('recompensas')
      .select('*')
      .in('estado', ['activa', 'pausada'])
      .order('costo_oro', { ascending: true });
    if (error) throw error;
    return json({ recompensas: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}

// Canje: valida jugador.oro >= costo (409 con {error, faltan} si no alcanza). Registra
// el evento 'compra_recompensa' con oro NEGATIVO y ref_id NULL (ref_id de la recompensa
// violaría la unique parcial (tipo, ref_id) en el segundo canje de la misma recompensa;
// la referencia queda en meta.recompensa_id). Incrementa veces_canjeada.
async function canjearRecompensa(sb: SupabaseClient, id: string) {
  const { data: recompensa, error: errRecompensa } = await sb
    .from('recompensas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (errRecompensa) throw errRecompensa;
  if (!recompensa || recompensa.estado === 'archivada') {
    return json({ error: 'recompensa no encontrada' }, 404);
  }

  const { data: jugadorRows, error: errJugador } = await sb
    .from('jugador')
    .select('id, oro')
    .limit(1);
  if (errJugador) throw errJugador;
  const jugador = jugadorRows?.[0];
  if (!jugador) return json({ error: 'jugador no encontrado' }, 404);

  const costo = recompensa.costo_oro ?? 0;
  if ((jugador.oro ?? 0) < costo) {
    return json({ error: 'oro insuficiente', faltan: costo - (jugador.oro ?? 0) }, 409);
  }

  const resultado = await registrarEvento(sb, {
    tipo: 'compra_recompensa',
    ref_tabla: 'recompensas',
    xp: 0,
    oro: -costo,
    meta: { recompensa_id: recompensa.id, nombre: recompensa.nombre },
  });
  if (!resultado) return json({ error: 'no se pudo registrar el canje' }, 502);

  const { error: errUpdate } = await sb
    .from('recompensas')
    .update({ veces_canjeada: (recompensa.veces_canjeada ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', recompensa.id);
  if (errUpdate) throw errUpdate;

  return json({ ok: true, oroRestante: (jugador.oro ?? 0) - costo });
}

// POST: dos formas.
// 1) {nombre, descripcion?, costo_oro, icono?} -> crea una recompensa nueva.
// 2) {canjear: id} -> canjea una recompensa existente (valida oro suficiente).
export async function crearOCanjearRecompensa(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const sb = getSupabaseServer();

    if (body.canjear) {
      return await canjearRecompensa(sb, body.canjear.toString());
    }

    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const costoOro = Number(body.costo_oro);
    if (!Number.isFinite(costoOro) || costoOro < 0) {
      return json({ error: 'costo_oro debe ser un número >= 0' }, 400);
    }

    const { data, error } = await sb
      .from('recompensas')
      .insert([{
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        costo_oro: Math.round(costoOro),
        icono: body.icono?.trim() || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, recompensa: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}

// PATCH ?id=: edita nombre/descripcion/costo_oro/icono, o cambia estado (pausar/archivar).
export async function actualizarRecompensa(request: Request): Promise<Response> {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'id requerido' }, 400);
    const body = await request.json();

    const patch: Record<string, unknown> = {};
    if ('nombre' in body) {
      const nombre = body.nombre?.toString().trim();
      if (!nombre) return json({ error: 'nombre requerido' }, 400);
      patch.nombre = nombre;
    }
    if ('descripcion' in body) patch.descripcion = body.descripcion?.toString().trim() || null;
    if ('icono' in body) patch.icono = body.icono?.toString().trim() || null;
    if ('costo_oro' in body) {
      const costo = Number(body.costo_oro);
      if (!Number.isFinite(costo) || costo < 0) return json({ error: 'costo_oro inválido' }, 400);
      patch.costo_oro = Math.round(costo);
    }
    if ('estado' in body) {
      if (!ESTADOS.includes(body.estado)) return json({ error: 'estado inválido' }, 400);
      patch.estado = body.estado;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    patch.updated_at = new Date().toISOString();

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('recompensas')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, recompensa: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}
