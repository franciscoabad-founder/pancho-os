export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

const PLATAFORMAS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'];

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const dias = Number(url.searchParams.get('dias')) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const desdeStr = desde.toISOString().slice(0, 10);

    const [{ data: metricas, error: metricasError }, { data: posts, error: postsError }] = await Promise.all([
      sb
        .from('redes_metricas')
        .select('*')
        .gte('fecha', desdeStr)
        .order('fecha', { ascending: true }),
      sb
        .from('redes_posts')
        .select('*')
        .gte('publicado_at', desde.toISOString())
        .order('publicado_at', { ascending: false }),
    ]);
    if (metricasError) throw metricasError;
    if (postsError) throw postsError;

    const filas = metricas ?? [];
    const plataformas: Record<string, { actual: any; serie: any[] }> = {};
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

    const posts_top = (posts ?? [])
      .map((p) => ({
        ...p,
        _interacciones: (Number(p.likes) || 0) + (Number(p.comentarios) || 0) + (Number(p.compartidos) || 0),
      }))
      .sort((a, b) => b._interacciones - a._interacciones)
      .slice(0, 10)
      .map(({ _interacciones, ...p }) => p);

    return json({ plataformas, posts_top });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const plataforma = body.plataforma?.trim();
    if (!plataforma || !PLATAFORMAS.includes(plataforma)) {
      return json({ error: `plataforma debe ser una de: ${PLATAFORMAS.join(', ')}` }, 400);
    }
    if (!body.fecha) {
      return json({ error: 'fecha requerida' }, 400);
    }
    const sb = getSupabaseServer();

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

    let postsGuardados: any[] = [];
    if (Array.isArray(body.posts) && body.posts.length) {
      const postsPayload = body.posts
        .filter((p: any) => p.post_id)
        .map((p: any) => ({
          plataforma: p.plataforma?.trim() && PLATAFORMAS.includes(p.plataforma.trim()) ? p.plataforma.trim() : plataforma,
          post_id: String(p.post_id),
          url: p.url?.trim() || null,
          titulo: p.titulo?.trim() || null,
          publicado_at: p.publicado_at || null,
          alcance: numOrNull(p.alcance),
          impresiones: numOrNull(p.impresiones),
          likes: numOrNull(p.likes),
          comentarios: numOrNull(p.comentarios),
          compartidos: numOrNull(p.compartidos),
          guardados: numOrNull(p.guardados),
          raw: p.raw ?? null,
        }));
      if (postsPayload.length) {
        const { data: postsData, error: postsError } = await sb
          .from('redes_posts')
          .upsert(postsPayload, { onConflict: 'plataforma,post_id' })
          .select();
        if (postsError) throw postsError;
        postsGuardados = postsData ?? [];
      }
    }

    return json({ metrica: data, posts: postsGuardados }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
