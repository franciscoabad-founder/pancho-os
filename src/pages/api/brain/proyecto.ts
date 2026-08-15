export const prerender = false;

import type { APIRoute } from 'astro';
import { createGbrainClient } from '../../../os/lib/gbrain';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Tags live in the structured `tags` array and inline in the body as `Tags: [a, b]`.
function pageTags(structured: string[] | undefined, body: string | undefined): string[] {
  const out = new Set<string>();
  const norm = (t: string) => t.trim().replace(/^#/, '').toLowerCase();
  for (const t of structured ?? []) { const n = norm(t); if (n) out.add(n); }
  const m = (body ?? '').match(/Tags:\s*\[([^\]]*)\]/i);
  if (m) for (const raw of m[1].split(',')) { const n = norm(raw); if (n) out.add(n); }
  return [...out];
}

// Split a page body into a brief and a list of pending items.
// Pendientes = unchecked checkboxes (- [ ]) anywhere, plus bullets under a
// heading that reads like "Pendientes / Tareas / To-do / Siguiente / Acciones".
function splitBrief(body: string): { brief: string; pendientes: string[] } {
  const lines = (body ?? '').split('\n');
  const pendientes: string[] = [];
  const briefLines: string[] = [];
  const headingPendiente = /pendiente|tareas?|to.?do|siguiente|acci(o|ó)n|next/i;
  let inPendienteSection = false;

  for (const line of lines) {
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      inPendienteSection = headingPendiente.test(heading[1]);
      if (!inPendienteSection) briefLines.push(line);
      continue;
    }
    const checkbox = line.match(/^\s*[-*]\s*\[\s\]\s+(.*)$/); // unchecked
    const checkedBox = /^\s*[-*]\s*\[[xX]\]\s+/.test(line);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);

    if (checkbox) {
      pendientes.push(checkbox[1].trim());
      continue;
    }
    if (inPendienteSection && bullet && !checkedBox) {
      pendientes.push(bullet[1].trim());
      continue;
    }
    if (inPendienteSection) {
      // keep non-bullet lines of the pendientes section out of the brief too,
      // unless it's blank (blank lines are harmless)
      if (line.trim() === '') briefLines.push(line);
      continue;
    }
    briefLines.push(line);
  }

  const brief = briefLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // dedupe pendientes preserving order
  const seen = new Set<string>();
  const dedup = pendientes.filter((p) => p && !seen.has(p) && seen.add(p));
  return { brief, pendientes: dedup };
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (!token || token !== expected) return json({ error: 'Unauthorized' }, 401);

  const tag = (url.searchParams.get('tag') ?? '').trim().toLowerCase();
  if (!tag) return json({ error: 'tag requerido' }, 400);

  const gbrainToken = import.meta.env.GBRAIN_TOKEN;
  if (!gbrainToken) return json({ error: 'GBRAIN_TOKEN not configured' }, 500);

  const brain = createGbrainClient(gbrainToken);

  try {
    // Primary: ask gbrain for pages tagged `tag`.
    let pages = await brain.listPagesByTag(tag, 50).catch(() => [] as Awaited<ReturnType<typeof brain.listPagesByTag>>);

    // Fallback: if the structured tag index returns nothing, scan recent pages
    // and match on inline/structured tags ourselves (some pages tag inline only).
    let fullById: Record<string, Awaited<ReturnType<typeof brain.getPage>> | null> = {};
    if (!pages.length) {
      const recent = await brain.listPages({ limit: 100, sort: 'updated_desc' });
      const fulls = await Promise.all(recent.map((p) => brain.getPage(p.slug).catch(() => null)));
      pages = recent.filter((p, i) => {
        fullById[p.slug] = fulls[i];
        return pageTags(fulls[i]?.tags, fulls[i]?.compiled_truth).includes(tag);
      });
    }

    const fulls = await Promise.all(
      pages.map(async (p) => fullById[p.slug] ?? (await brain.getPage(p.slug).catch(() => null)))
    );

    const proyecto = pages.map((p, i) => {
      const full = fulls[i];
      const body = full?.compiled_truth ?? '';
      const { brief, pendientes } = splitBrief(body);
      return {
        slug: p.slug,
        titulo: p.title,
        tipo: p.type,
        tags: pageTags(full?.tags, body),
        brief,
        pendientes,
        fecha: new Date(p.updated_at).toLocaleDateString('es', {
          day: 'numeric', month: 'short', year: 'numeric',
        }),
      };
    });

    return json({ tag, paginas: proyecto });
  } catch (err) {
    return json({ error: String(err) }, 502);
  }
};
