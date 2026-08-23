// Logica pura del grafo de ideas de gbrain.
//
// Portada de src/pages/api/brain/graph.ts (Astro) sin cambios de comportamiento:
// mismo cache en memoria, mismos umbrales de truncado, mismo agrupado por tag y
// mismo shape de respuesta que consume src/os/components/OSGraphBrain.tsx.
//
// Vive aparte de src/server/brain.handlers.ts porque es el unico handler del
// brain con estado de modulo (el cache), y mezclarlo con funciones puras haria
// mas dificil razonar sobre ese archivo.

import { readEnv } from '../lib/env.ts';
import { createGbrainClient } from '../os/lib/gbrain.ts';

// Cache en memoria (por instancia del proceso, TTL 5 min). Se pierde en cada
// redeploy, que es exactamente lo que queremos.
let cache: { data: DatosGrafo; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// Por encima de esta cantidad de paginas vivas se degrada por defecto a una
// vista "top N por conexiones". El cliente puede pedir el set completo con ?all=1.
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
  const wrapper = raw as { sources?: unknown } | null;
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(wrapper?.sources)
      ? (wrapper.sources as unknown[])
      : [];
  const names = arr
    .map((s) => {
      if (typeof s === 'string') return s;
      if (s && typeof s === 'object') {
        const o = s as Record<string, unknown>;
        return (o.name ?? o.label ?? o.id ?? o.type ?? null) as string | null;
      }
      return null;
    })
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
  return [...new Set(names)];
}

// Los tags viven en dos lados: el array estructurado `tags` (poblado en algunas
// paginas) e inline en el cuerpo como `Tags: [arazza, marca]`. Se mezclan y
// normalizan los dos.
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

// Corre trabajo async sobre una lista con concurrencia acotada, para no disparar
// cientos de requests simultaneas contra el endpoint MCP de gbrain.
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

interface NodoGrafo {
  id: string;
  label: string;
  type: string;
  group: string;
  tags: string[];
  updated_at: string;
  connections: number;
}

interface AristaGrafo {
  source: string;
  target: string;
  both: boolean;
}

export interface DatosGrafo {
  __key: string;
  nodes: NodoGrafo[];
  edges: AristaGrafo[];
  sources: string[];
  meta: {
    notes: number;
    notes_shown: number;
    edges: number;
    connected: number;
    orphans: number;
    bidirectional: number;
    truncated: boolean;
    top_n: number;
  };
}

/**
 * Devuelve el grafo del brain. `wantAll` corresponde a `?all=1`.
 *
 * Lanza Error('GBRAIN_TOKEN not configured') si falta la credencial; la route
 * lo traduce a 500 igual que hacia la version Astro.
 */
export async function obtenerGrafoBrain(wantAll: boolean): Promise<DatosGrafo> {
  const cacheKey = wantAll ? 'all' : 'default';

  if (cache && cache.data.__key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }

  const gbrainToken = readEnv('GBRAIN_TOKEN');
  if (!gbrainToken) throw new Error('GBRAIN_TOKEN not configured');

  const brain = createGbrainClient(gbrainToken);

  // Todas las paginas vivas: el server capa list_pages a 100 por llamada, asi
  // que listAllPages pagina por offset hasta traer el corpus completo.
  const allPages = await brain.listAllPages({ sort: 'updated_desc' });
  const pages = allPages.filter((p) => !EXCLUDED_SLUGS.has(p.slug));
  const slugSet = new Set(pages.map((p) => p.slug));

  // Paginas completas (tags), wikilinks reales y fuentes en paralelo, con
  // concurrencia acotada.
  const [fullResults, linksResults, sourcesRaw] = await Promise.all([
    mapLimit(pages, 15, (p) => brain.getPage(p.slug).catch(() => null)),
    mapLimit(pages, 15, (p) => brain.getLinks(p.slug).catch(() => [])),
    brain.sourcesList().catch(() => null),
  ]);

  const normalizedSources = normalizeSources(sourcesRaw);
  const sources = normalizedSources.length > 0 ? normalizedSources : DEFAULT_SOURCES;

  const tagsByIndex = pages.map((_, i) =>
    extractTags(fullResults[i]?.tags, fullResults[i]?.compiled_truth),
  );

  // Solo aristas reales: wikilinks resueltos por gbrain, source -> target. Se
  // descarta lo que apunte a un slug que no tenemos como nodo (link colgante).
  // Una sola arista por par, pero conservando la direccion del wikilink:
  // `both: true` cuando las dos paginas se enlazan entre si.
  const edgeMap = new Map<string, AristaGrafo>();
  pages.forEach((p, i) => {
    for (const link of linksResults[i] ?? []) {
      const l = link as { target_slug?: string; to_slug?: string };
      const target = l.target_slug ?? l.to_slug;
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

  // Conteo de conexiones (backlinks + forward links) por nodo: define su tamano.
  const connCount: Record<string, number> = {};
  for (const e of edges) {
    connCount[e.source] = (connCount[e.source] ?? 0) + 1;
    connCount[e.target] = (connCount[e.target] ?? 0) + 1;
  }

  let nodes: NodoGrafo[] = pages.map((p, i) => ({
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
    // Los 100 nodos actualizados mas recientemente.
    const sortedByRecency = [...nodes].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    const seedNodes = sortedByRecency.slice(0, 100);
    const seedIds = new Set(seedNodes.map((n) => n.id));
    // El esqueleto jerarquico (pancho + paginas canon) siempre sobrevive el truncado.
    for (const n of nodes) {
      if (n.id === 'pancho' || n.id.endsWith('-canon')) seedIds.add(n.id);
    }

    // Se conservan las aristas conectadas a o desde los nodos semilla.
    const activeEdges = edges.filter((e) => seedIds.has(e.source) || seedIds.has(e.target));
    const activeNodeIds = new Set<string>();
    activeEdges.forEach((e) => {
      activeNodeIds.add(e.source);
      activeNodeIds.add(e.target);
    });
    // Todos los nodos semilla entran al set activo.
    seedIds.forEach((id) => activeNodeIds.add(id));

    nodes = nodes.filter((n) => activeNodeIds.has(n.id));
    finalEdges = edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));

    // Se recalcula el conteo de conexiones para el subconjunto visible.
    const filteredConnCount: Record<string, number> = {};
    for (const e of finalEdges) {
      filteredConnCount[e.source] = (filteredConnCount[e.source] ?? 0) + 1;
      filteredConnCount[e.target] = (filteredConnCount[e.target] ?? 0) + 1;
    }
    nodes.forEach((n) => {
      n.connections = filteredConnCount[n.id] ?? 0;
    });
  }

  const data: DatosGrafo = {
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

  return data;
}
