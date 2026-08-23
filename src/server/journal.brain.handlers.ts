// Sincronizacion de un dia del Diario a gbrain.
//
// Vive aparte de journal.handlers.ts porque es lo unico del modulo que sale a
// la red (gbrain) y necesita credencial: asi el resto del Diario sigue siendo
// puro y testeable sin tocar env.
//
// El cuerpo se valida con el contrato compartido src/lib/brain-write.ts antes
// de escribir: mismos tags de la lista cerrada, slug kebab-case, wikilink
// obligatorio y evidencia con confidence 2 (Brain create lo exige).

import { readEnv } from '../lib/env.ts';
import { createGbrainClient } from '../os/lib/gbrain.ts';
import {
  bindBrainWriteToTenant,
  createDedupeKey,
  validateBrainWrite,
  type BrainWriteClientInput,
} from '../lib/brain-write.ts';
import {
  componerMarkdownDia,
  listarEntradas,
  marcarBrainSlug,
  slugDelDia,
  type EntradaJournal,
} from './journal.handlers.ts';

// Seam de escritura: en produccion es gbrain real, en tests se inyecta.
export type EscritorBrain = (pagina: { slug: string; title: string; body: string; tags: string[] }) => Promise<void>;

let escritorActual: EscritorBrain | null = null;

export function setEscritorBrain(fn: EscritorBrain | null): void {
  escritorActual = fn;
}

function escritorGbrain(): EscritorBrain {
  const token = readEnv('GBRAIN_TOKEN');
  if (!token) {
    throw new Error('GBRAIN_TOKEN no configurado: no se puede sincronizar el diario al brain.');
  }
  const brain = createGbrainClient(token);
  return async (pagina) => {
    await brain.putPage({ ...pagina, type: 'note' });
  };
}

export interface ResultadoSyncBrain {
  slug: string;
  fecha: string;
  entradas: number;
}

export async function sincronizarDiaAlBrain(fechaRaw: unknown): Promise<ResultadoSyncBrain> {
  const fecha = String(fechaRaw ?? '').trim();
  const slug = slugDelDia(fecha); // valida el formato YYYY-MM-DD

  const entradas = (await listarEntradas({ fecha })) as EntradaJournal[];
  if (!entradas.length) throw new Error(`no hay entradas de diario para ${fecha}`);

  const title = `Diario ${fecha}`;
  const body = componerMarkdownDia(fecha, entradas);
  const sourceRef = `os:journal:${fecha}`;

  const tenant = readEnv('GBRAIN_TENANT_ID') ?? 'pancho';

  const input: BrainWriteClientInput = {
    target: 'brain',
    op: 'create',
    slug,
    title,
    body,
    tags: ['os', 'personal'],
    wikilinks: ['pancho-os', 'hermes'],
    evidence: {
      source: 'os',
      source_ref: sourceRef,
      observed_at: new Date().toISOString(),
      confidence: 2,
    },
    dedupe_key: await createDedupeKey(tenant, title, sourceRef),
  };

  const write = bindBrainWriteToTenant(tenant, 'human', input);
  const validacion = validateBrainWrite(write);
  if (!validacion.ok) throw new Error(`brain-write invalido: ${validacion.issues.join('; ')}`);

  const escritor = escritorActual ?? escritorGbrain();
  await escritor({ slug, title, body, tags: write.tags });
  await marcarBrainSlug(fecha, slug);

  return { slug, fecha, entradas: entradas.length };
}
