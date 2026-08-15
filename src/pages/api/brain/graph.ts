export const prerender = false;

import type { APIRoute } from 'astro';
import { createGbrainClient } from '../../../os/lib/gbrain';

// In-memory cache (per-serverless-instance, 5 min TTL). Reset on redeploy.
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// Above this many live pages we degrade to a "top N by connections" view by
// default. The client can still ask for the full set with ?all=1.
const TRUNCATE_ABOVE = 300;
const TOP_N = 180;

// Slugs que nunca se dibujan: la pagina hub "canon" y el canon deprecado.
const EXCLUDED_SLUGS = new Set(['canon', 'growth-os-canon']);

// Mapeo tag -> grupo por prioridad. Una pagina toma el PRIMER tag de esta
// lista que tenga (no el orden de sus propios tags). Proyectos primero,
// luego areas, luego tags de sistema (que colapsan todos en "sistema").
const TAG_TO_GROUP: Array<[string, string]> = [
  // Proyectos
  ['braintech', 'braintech'],
  ['rafik', 'rafik'],
  ['cortex', 'cortex'],
  ['taskr', 'taskr'],
  ['arazza', 'arazza'],
  ['codeis', 'codeis'],
  ['fonquito', 'fonquito'],
  ['flow', 'flow'],
  ['kronek', 'kronek'],
  // Areas
  ['marca', 'marca'],
  ['contenido', 'contenido'],
  ['gtm', 'gtm'],
  ['personal', 'personal'],
  ['familia', 'familia'],
  ['salud', 'salud'],
  ['finanzas', 'finanzas'],
  // Sistema (todos agrupan como "sistema")
  ['os', 'sistema'],
  ['panchoatlas', 'sistema'],
  ['gbrain', 'sistema'],
  ['hermes', 'sistema'],
  ['n8n', 'sistema'],
  ['vps', 'sistema'],
];

function groupFromTags(tags: string[]): string {
  const set = new Set(tags);
  for (const [tag, group] of TAG_TO_GROUP) {
    if (set.has(tag)) return group;
  }
  return 'otros';
}

// Fallback si sources_list falla o viene vacio.
const DEFAULT_SOURCES = ['Telegram', 'Reuniones', 'Repos de código', 'Chats IA', 'Manual'];

// sources_list puede devolver strings, objetos o un wrapper { sources: [...] }.
function normalizeSources(raw: unknown): string[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.sources)
      ? (raw as any).sources
      : [];
  const names = arr
    .map((s: any) => {
      if (typeof s === 'string') return s;
      if (s && typeof s === 'object') return s.name ?? s.label ?? s.id ?? s.type ?? null;
      return null;
    })
    .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s: string) => s.trim());
  return [...new Set(names)];
}

// Tags live in two places: the structured `tags` array (populated on some pages)
// and inline in the body as `Tags: [arazza, marca]`. Merge + normalize both.
function extractTags(structured: string[] | undefined, body: string | undefined): string[] {
  const out = new Set<string>();
  const norm = (t: string) => t.trim().replace(/^#/, '').toLowerCase();

  for (const t of structured ?? []) {
    const n = norm(t);
    if (n) out.add(n);
  }

  const m = (body ?? '').match(/Tags:\s*\[([^\]]*)\]/i);
  if (m) {
    for (const raw of m[1].split(',')) {
      const n = norm(raw);
      if (n) out.add(n);
    }
  }

  return [...out];
}

// Run async work over a list with bounded concurrency so we don't fire
// hundreds of simultaneous requests at the gbrain MCP endpoint.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const token = cookies.get('os_auth')?.value;
  const expected = import.meta.env.OS_AUTH_TOKEN;
  if (!token || token !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const wantAll = url.searchParams.get('all') === '1';
  const cacheKey = wantAll ? 'all' : 'default';

  if (cache && (cache.data as any)?.__key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    return new Response(JSON.stringify(cache.data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gbrainToken = import.meta.env.GBRAIN_TOKEN;
  if (!gbrainToken) {
    return new Response(JSON.stringify({ error: 'GBRAIN_TOKEN not configured' }), { status: 500 });
  }

  const brain = createGbrainClient(gbrainToken);

  try {
    // Pull every live page (not just the last 100). 500 is comfortably above
    // the current corpus size (~240) and cheap for list_pages.
    const allPages = await brain.listPages({ limit: 500, sort: 'updated_desc' });
    const pages = allPages.filter((p) => !EXCLUDED_SLUGS.has(p.slug));
    const slugSet = new Set(pages.map((p) => p.slug));

    // Fetch full pages (tags), real wikilinks y fuentes en paralelo, capped concurrency.
    const [fullResults, linksResults, sourcesRaw] = await Promise.all([
      mapLimit(pages, 15, (p) => brain.getPage(p.slug).catch(() => null)),
      mapLimit(pages, 15, (p) => brain.getLinks(p.slug).catch(() => [])),
      brain.sourcesList().catch(() => null),
    ]);

    const normalizedSources = normalizeSources(sourcesRaw);
    const sources = normalizedSources.length > 0 ? normalizedSources : DEFAULT_SOURCES;

    const tagsByIndex = pages.map((_, i) =>
      extractTags(fullResults[i]?.tags, fullResults[i]?.compiled_truth)
    );

    // Real edges only: actual wikilinks resolved by gbrain, source -> target.
    // Drop anything pointing at a slug we don't have as a node (dangling link).
    // Una sola arista por par, pero conservando la direccion del wikilink:
    // `both: true` cuando las dos paginas se enlazan entre si.
    const edgeMap = new Map<string, { source: string; target: string; both: boolean }>();
    pages.forEach((p, i) => {
      for (const link of linksResults[i] ?? []) {
        const target = (link as any).target_slug ?? (link as any).to_slug;
        if (!target || target === p.slug || !slugSet.has(target)) continue;
        const key = [p.slug, target].sort().join('|');
        const existing = edgeMap.get(key);
        if (!existing) {
          edgeMap.set(key, { source: p.slug, target, both: false });
          continue;
        }
        // Ya existe el par: si el sentido es el contrario, es reciproco.
        if (existing.source !== p.slug) existing.both = true;
      }
    });
    const edges = [...edgeMap.values()];

    // Connection count (backlinks + forward links) per node — drives node size.
    const connCount: Record<string, number> = {};
    for (const e of edges) {
      connCount[e.source] = (connCount[e.source] ?? 0) + 1;
      connCount[e.target] = (connCount[e.target] ?? 0) + 1;
    }

    let nodes = pages.map((p, i) => ({
      id: p.slug,
      label: p.title,
      type: p.type,
      group: groupFromTags(tagsByIndex[i]),
      tags: tagsByIndex[i],
      updated_at: p.updated_at,
      connections: connCount[p.slug] ?? 0,
    }));

    let finalEdges = edges;
    let truncated = false;

    if (nodes.length > TRUNCATE_ABOVE && !wantAll) {
      truncated = true;
      // Get the 100 most recently updated nodes
      const sortedByRecency = [...nodes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const seedNodes = sortedByRecency.slice(0, 100);
      const seedIds = new Set(seedNodes.map((n) => n.id));
      // El esqueleto jerarquico (pancho + paginas canon) siempre sobrevive el truncado.
      for (const n of nodes) {
        if (n.id === 'pancho' || n.id.endsWith('-canon')) seedIds.add(n.id);
      }

      // Keep edges connected to or from the seed nodes
      const activeEdges = edges.filter((e) => seedIds.has(e.source) || seedIds.has(e.target));
      const activeNodeIds = new Set<string>();
      activeEdges.forEach((e) => {
        activeNodeIds.add(e.source);
        activeNodeIds.add(e.target);
      });
      // Ensure all seed nodes are in the active set
      seedIds.forEach((id) => activeNodeIds.add(id));

      // Filter nodes and edges
      nodes = nodes.filter((n) => activeNodeIds.has(n.id));
      finalEdges = edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));

      // Recompute connections count for the visible subset
      const filteredConnCount: Record<string, number> = {};
      for (const e of finalEdges) {
        filteredConnCount[e.source] = (filteredConnCount[e.source] ?? 0) + 1;
        filteredConnCount[e.target] = (filteredConnCount[e.target] ?? 0) + 1;
      }
      nodes.forEach((n) => {
        n.connections = filteredConnCount[n.id] ?? 0;
      });
    }

    const data = {
      __key: cacheKey,
      nodes,
      edges: finalEdges,
      sources,
      meta: {
        notes: pages.length,
        notes_shown: nodes.length,
        edges: finalEdges.length,
        connected: nodes.filter((n) => n.connections > 0).length,
        orphans: nodes.filter((n) => n.connections === 0).length,
        bidirectional: finalEdges.filter((e) => e.both).length,
        truncated,
        top_n: TOP_N,
      },
    };
    cache = { data, ts: Date.now() };

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502 });
  }
};
