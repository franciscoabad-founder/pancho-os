export const prerender = false;

import type { APIRoute } from 'astro';
import { createGbrainClient } from '../../../os/lib/gbrain';

export const GET: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (!token || token !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const slug = url.searchParams.get('slug')?.trim();
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug requerido' }), { status: 400 });
  }

  const gbrainToken = import.meta.env.GBRAIN_TOKEN;
  if (!gbrainToken) {
    return new Response(JSON.stringify({ error: 'GBRAIN_TOKEN not configured' }), { status: 500 });
  }

  const brain = createGbrainClient(gbrainToken);

  try {
    const page = await brain.getPage(slug);
    return new Response(JSON.stringify({
      slug: page.slug,
      titulo: page.title,
      tipo: page.type,
      tags: page.tags ?? [],
      contenido: page.compiled_truth ?? '',
      fecha: new Date(page.updated_at).toLocaleDateString('es', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }
};
