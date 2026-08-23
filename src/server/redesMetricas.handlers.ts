// Logica pura de metricas de redes (tablas `redes_metricas` y `redes_posts`).
//
// Extraida de src/pages/api/redes-metricas.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseRedesMetricas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const PLATAFORMAS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'];

export function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface FilaMetrica {
  plataforma: string;
  fecha: string;
  seguidores: number | null;
  alcance: number | null;
  interacciones: number | null;
  [k: string]: unknown;
}

export interface ResumenRedes {
  plataformas: Record<string, { actual: unknown; serie: unknown[] }>;
  posts_top: unknown[];
}

export async function resumenRedes(diasRaw: string | null): Promise<ResumenRedes> {
  const sb = clienteActual();
  const dias = Number(diasRaw) || 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeStr = desde.toISOString().slice(0, 10);

  const [{ data: metricas, error: metricasError }, { data: posts, error: postsError }] = await Promise.all([
    sb.from('redes_metricas').select('*').gte('fecha', desdeStr).order('fecha', { ascending: true }),
    sb.from('redes_posts').select('*').gte('publicado_at', desde.toISOString()).order('publicado_at', { ascending: false }),
  ]);
  if (metricasError) throw metricasError;
  if (postsError) throw postsError;

  const filas = (metricas ?? []) as FilaMetrica[];
  const plataformas: Record<string, { actual: unknown; serie: unknown[] }> = {};
  for (const p of PLATAFORMAS) {
    const serie = filas.filter((f) => f.plataforma === p);
    if (!serie.length) continue;
    plataformas[p] = {
      actual: serie[serie.length - 1],
      serie: serie.map((f) => ({
        fecha: f.fecha,
        seguidores: f.seguidores,
        alcance: f.alcance,
        interacciones: f.interacciones,
      })),
    };
  }

  const posts_top = ((posts ?? []) as Record<string, unknown>[])
    .map((p) => ({
      ...p,
      _interacciones: (Number(p.likes) || 0) + (Number(p.comentarios) || 0) + (Number(p.compartidos) || 0),
    }))
    .sort((a, b) => b._interacciones - a._interacciones)
    .slice(0, 10)
    .map(({ _interacciones, ...p }) => p);

  return { plataformas, posts_top };
}

export async function guardarMetrica(
  body: Record<string, unknown>,
): Promise<{ metrica: unknown; posts: unknown[] }> {
  const plataforma = (body.plataforma as string | undefined)?.trim();
  if (!plataforma || !PLATAFORMAS.includes(plataforma)) {
    throw new Error(`plataforma debe ser una de: ${PLATAFORMAS.join(', ')}`);
  }
  if (!body.fecha) throw new Error('fecha requerida');

  const sb = clienteActual();
  const payload = {
    plataforma,
    fecha: body.fecha,
    seguidores: numOrNull(body.seguidores),
    alcance: numOrNull(body.alcance),
    impresiones: numOrNull(body.impresiones),
    interacciones: numOrNull(body.interacciones),
    publicaciones: numOrNull(body.publicaciones),
    engagement_rate: numOrNull(body.engagement_rate),
    raw: body.raw ?? null,
  };

  const { data, error } = await sb
    .from('redes_metricas')
    .upsert(payload, { onConflict: 'plataforma,fecha' })
    .select()
    .single();
  if (error) throw error;

  let postsGuardados: unknown[] = [];
  const postsEntrada = body.posts as Record<string, unknown>[] | undefined;
  if (Array.isArray(postsEntrada) && postsEntrada.length) {
    const postsPayload = postsEntrada
      .filter((p) => p.post_id)
      .map((p) => {
        const suPlataforma = (p.plataforma as string | undefined)?.trim();
        return {
          plataforma: suPlataforma && PLATAFORMAS.includes(suPlataforma) ? suPlataforma : plataforma,
          post_id: String(p.post_id),
          url: (p.url as string | undefined)?.trim() || null,
          titulo: (p.titulo as string | undefined)?.trim() || null,
          publicado_at: p.publicado_at || null,
          alcance: numOrNull(p.alcance),
          impresiones: numOrNull(p.impresiones),
          likes: numOrNull(p.likes),
          comentarios: numOrNull(p.comentarios),
          compartidos: numOrNull(p.compartidos),
          guardados: numOrNull(p.guardados),
          raw: p.raw ?? null,
        };
      });
    if (postsPayload.length) {
      const { data: postsData, error: postsError } = await sb
        .from('redes_posts')
        .upsert(postsPayload, { onConflict: 'plataforma,post_id' })
        .select();
      if (postsError) throw postsError;
      postsGuardados = postsData ?? [];
    }
  }

  return { metrica: data, posts: postsGuardados };
}
