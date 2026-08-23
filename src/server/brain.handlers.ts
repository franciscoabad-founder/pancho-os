// Logica pura del brain (gbrain): feed de notas, nota suelta, busqueda y
// vista de proyecto por tag.
//
// Extraida de src/pages/api/brain/{notes,note,search,proyecto}.ts (Astro) para
// reusarse desde las server routes de TanStack Start. No depende de Astro ni
// del framework. El grafo, que es el unico con cache de modulo, vive aparte en
// src/server/brainGraph.handlers.ts.

import { readEnv } from '../lib/env.ts';
import { createGbrainClient } from '../os/lib/gbrain.ts';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

export interface NotaBrain {
  slug: string;
  titulo: string;
  resumen: string;
  tags: string[];
  tipo: string;
  fecha: string;
  conexiones: unknown[];
}

export interface ResultadoBrainNotes {
  notes: NotaBrain[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export async function listarNotasBrain(
  limitRaw: string | null,
  pageRaw: string | null,
  tagRaw: string | null,
): Promise<ResultadoBrainNotes> {
  const token = readEnv('GBRAIN_TOKEN');
  if (!token) {
    throw new Error('GBRAIN_TOKEN not configured');
  }

  const limit = Math.min(Number(limitRaw ?? String(DEFAULT_LIMIT)), MAX_LIMIT);
  const page = Math.max(Number(pageRaw ?? '1'), 1);
  const tag = tagRaw?.trim() || undefined;

  const brain = createGbrainClient(token);

  const allPages = await brain.listAllPages({ sort: 'updated_desc', ...(tag ? { tag } : {}) });
  const total = allPages.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const offset = (Math.min(page, pages) - 1) * limit;
  const slice = allPages.slice(offset, offset + limit);

  const full = await Promise.all(
    slice.map((p) =>
      brain.getPage(p.slug).catch(() => ({ ...p, compiled_truth: '', tags: [] }))
    ),
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
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      conexiones: [],
    };
  });

  return { notes, total, page: Math.min(page, pages), pages, limit };
}

/** Cliente de gbrain con la credencial ya validada. */
function clienteBrain() {
  const token = readEnv('GBRAIN_TOKEN');
  if (!token) throw new Error('GBRAIN_TOKEN not configured');
  return createGbrainClient(token);
}

// --- Nota suelta ------------------------------------------------------------
//
// Portada literal de src/pages/api/brain/note.ts. Se conserva el shape exacto
// que consume el modal de /cerebro.

export interface NotaBrainDetalle {
  slug: string;
  titulo: string;
  tipo: string;
  tags: string[];
  contenido: string;
  fecha: string;
}

export async function obtenerNotaBrain(slug: string): Promise<NotaBrainDetalle> {
  const page = await clienteBrain().getPage(slug);
  return {
    slug: page.slug,
    titulo: page.title,
    tipo: page.type,
    tags: page.tags ?? [],
    contenido: page.compiled_truth ?? '',
    fecha: new Date(page.updated_at).toLocaleDateString('es', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  };
}

// --- Busqueda ---------------------------------------------------------------
//
// Portada literal de src/pages/api/brain/search.ts.

export interface ResultadoBusquedaBrain {
  slug: string;
  titulo: string;
  resumen: string;
  score: number;
}

export async function buscarEnBrain(q: string): Promise<ResultadoBusquedaBrain[]> {
  const raw = await clienteBrain().query(q, 8);
  return raw.map((r) => ({
    slug: r.slug,
    titulo: r.title,
    resumen: (r.chunk_text ?? '').replace(/\n+/g, ' ').trim().slice(0, 200),
    score: r.score,
  }));
}

// --- Vista de proyecto por tag ----------------------------------------------
//
// Portada literal de src/pages/api/brain/proyecto.ts.

// Los tags viven en el array estructurado `tags` y tambien inline en el cuerpo
// como `Tags: [a, b]`. Se mezclan y normalizan los dos.
function pageTags(structured: string[] | undefined, body: string | undefined): string[] {
  const out = new Set<string>();
  const norm = (t: string) => t.trim().replace(/^#/, '').toLowerCase();
  for (const t of structured ?? []) { const n = norm(t); if (n) out.add(n); }
  const m = (body ?? '').match(/Tags:\s*\[([^\]]*)\]/i);
  if (m) for (const raw of m[1].split(',')) { const n = norm(raw); if (n) out.add(n); }
  return [...out];
}

// Parte el cuerpo de una pagina en un brief y una lista de pendientes.
// Pendientes = checkboxes sin marcar (- [ ]) en cualquier lado, mas los bullets
// bajo un heading que suene a "Pendientes / Tareas / To-do / Siguiente /
// Acciones".
export function splitBrief(body: string): { brief: string; pendientes: string[] } {
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
    const checkbox = line.match(/^\s*[-*]\s*\[\s\]\s+(.*)$/); // sin marcar
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
      // Las lineas sin bullet de la seccion de pendientes tampoco entran al
      // brief, salvo las vacias (que son inofensivas).
      if (line.trim() === '') briefLines.push(line);
      continue;
    }
    briefLines.push(line);
  }

  const brief = briefLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  // Dedupe de pendientes conservando el orden.
  const seen = new Set<string>();
  const dedup = pendientes.filter((p) => p && !seen.has(p) && seen.add(p));
  return { brief, pendientes: dedup };
}

export interface PaginaProyectoBrain {
  slug: string;
  titulo: string;
  tipo: string;
  tags: string[];
  brief: string;
  pendientes: string[];
  fecha: string;
}

export async function listarProyectoBrain(tag: string): Promise<PaginaProyectoBrain[]> {
  const brain = clienteBrain();

  // Camino principal: pedirle a gbrain las paginas con ese tag.
  let pages = await brain.listAllPages({ tag, sort: 'updated_desc' })
    .catch(() => [] as Awaited<ReturnType<typeof brain.listAllPages>>);

  // Fallback: si el indice estructurado de tags no devuelve nada, se escanean
  // las paginas recientes y se filtra por tags inline/estructurados a mano
  // (hay paginas que solo taggean inline).
  const fullById: Record<string, Awaited<ReturnType<typeof brain.getPage>> | null> = {};
  if (!pages.length) {
    const recent = await brain.listPages({ limit: 100, sort: 'updated_desc' });
    const fulls = await Promise.all(recent.map((p) => brain.getPage(p.slug).catch(() => null)));
    pages = recent.filter((p, i) => {
      fullById[p.slug] = fulls[i];
      return pageTags(fulls[i]?.tags, fulls[i]?.compiled_truth).includes(tag);
    });
  }

  const fulls = await Promise.all(
    pages.map(async (p) => fullById[p.slug] ?? (await brain.getPage(p.slug).catch(() => null))),
  );

  return pages.map((p, i) => {
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
}
