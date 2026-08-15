export const prerender = false;

import type { APIRoute } from 'astro';
import { createGbrainClient } from '../../../os/lib/gbrain';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

export const GET: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (!token || token !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const gbrainToken = import.meta.env.GBRAIN_TOKEN;
  if (!gbrainToken) {
    return new Response(JSON.stringify({ error: 'GBRAIN_TOKEN not configured' }), { status: 500 });
  }

  const limit = Math.min(Number(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1);
  const tag = (url.searchParams.get('tag') ?? '').trim() || undefined;

  const brain = createGbrainClient(gbrainToken);

  try {
    // list_pages filtra por tag server-side; con limit alto obtenemos el total
    // real del corpus (o del tag) y paginamos aqui.
    const allPages = await brain.listPages({ limit: 500, sort: 'updated_desc', ...(tag ? { tag } : {}) });
    const total = allPages.length;
    const pages = Math.max(Math.ceil(total / limit), 1);
    const offset = (Math.min(page, pages) - 1) * limit;
    const slice = allPages.slice(offset, offset + limit);

    // Solo hidratamos las notas de la pagina visible (12 get_page, no 400+).
    const full = await Promise.all(
      slice.map((p) =>
        brain.getPage(p.slug).catch(() => ({ ...p, compiled_truth: '', tags: [] }))
      )
    );

    const notes = full.map((p) => {
      const body = p.compiled_truth ?? '';
      const excerpt = body.replace(/^#+\s.*$/gm, '').replace(/\n+/g, ' ').trim().slice(0, 160);
      return {
        slug: p.slug,
        titulo: p.title,
        resumen: excerpt || p.title,
        tags: (p.tags ?? []).slice(0, 5),
        tipo: p.type,
        fecha: new Date(p.updated_at).toLocaleDateString('es', {
          day: 'numeric', month: 'short', year: 'numeric',
        }),
        conexiones: [],
      };
    });

    return new Response(JSON.stringify({ notes, total, page: Math.min(page, pages), pages, limit }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }
};
