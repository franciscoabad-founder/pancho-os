// Logica pura del feed de notas del brain (gbrain).
//
// Extraida de src/pages/api/brain/notes.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.

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
