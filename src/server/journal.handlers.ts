// Logica pura del Diario (tabla `os_journal`).
//
// Mismo patron que notas.handlers.ts: nada de este modulo conoce Astro,
// TanStack Start, Request ni Response. El cliente de Supabase entra por un seam
// inyectable para que los tests corran en memoria.
//
// El Diario es la bitacora de dias y procesos de Pancho: se escribe desde el
// OS, desde Hermes por MCP, desde Flow (dictado) y desde Android. Dos puentes
// salen de aca: `promoverAContenido` (una entrada publicable se vuelve una fila
// de os_contenido_ideas) y `componerMarkdownDia` (las entradas de un dia se
// arman como una pagina de gbrain).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseJournal(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const TIPOS = ['dia', 'proceso', 'decision', 'win', 'idea'] as const;
export type TipoEntrada = (typeof TIPOS)[number];

export const FUENTES = ['os', 'hermes', 'flow', 'android'] as const;
export type FuenteEntrada = (typeof FUENTES)[number];

const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 500;

export interface EntradaJournal {
  id: string;
  created_at: string;
  fecha: string;
  tipo: TipoEntrada;
  titulo: string | null;
  contenido: string;
  tags: string[];
  fuente: string;
  proyecto: string | null;
  publicable: boolean;
  brain_slug: string | null;
  mood: string | null;
}

export interface EntradaInput {
  fecha?: unknown;
  tipo?: unknown;
  titulo?: unknown;
  contenido?: unknown;
  tags?: unknown;
  fuente?: unknown;
  proyecto?: unknown;
  publicable?: unknown;
  mood?: unknown;
}

export interface FiltrosJournal {
  fecha?: string | null;
  tipo?: string | null;
  limit?: string | number | null;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizarTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
}

function textoOpcional(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

export async function listarEntradas(filtros: FiltrosJournal = {}): Promise<EntradaJournal[]> {
  const sb = clienteActual();
  let query = sb.from('os_journal').select('*');

  if (filtros.fecha) {
    const fecha = String(filtros.fecha).trim();
    if (!FECHA_RE.test(fecha)) throw new Error('fecha invalida: usa YYYY-MM-DD');
    query = query.eq('fecha', fecha);
  }
  if (filtros.tipo) {
    const tipo = String(filtros.tipo).trim();
    if (!TIPOS.includes(tipo as TipoEntrada)) throw new Error('tipo invalido');
    query = query.eq('tipo', tipo);
  }

  const limiteRaw = Number(filtros.limit ?? LIMIT_DEFAULT);
  const limite = Number.isFinite(limiteRaw) && limiteRaw > 0 ? Math.min(limiteRaw, LIMIT_MAX) : LIMIT_DEFAULT;

  // Orden por fecha y despues por created_at: la timeline agrupa por dia y
  // dentro del dia muestra lo mas nuevo arriba.
  const { data, error } = await query
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as EntradaJournal[];
}

export async function crearEntrada(input: EntradaInput): Promise<EntradaJournal> {
  const contenido = typeof input.contenido === 'string' ? input.contenido.trim() : '';
  if (!contenido) throw new Error('contenido requerido');

  const fila: Record<string, unknown> = {
    contenido,
    tags: normalizarTags(input.tags),
    titulo: textoOpcional(input.titulo),
    proyecto: textoOpcional(input.proyecto),
    publicable: input.publicable === true,
    mood: textoOpcional(input.mood),
  };

  if (input.tipo !== undefined && input.tipo !== null && input.tipo !== '') {
    const tipo = String(input.tipo).trim();
    if (!TIPOS.includes(tipo as TipoEntrada)) throw new Error('tipo invalido');
    fila.tipo = tipo;
  }
  if (input.fecha !== undefined && input.fecha !== null && input.fecha !== '') {
    const fecha = String(input.fecha).trim();
    if (!FECHA_RE.test(fecha)) throw new Error('fecha invalida: usa YYYY-MM-DD');
    fila.fecha = fecha;
  }
  if (input.fuente !== undefined && input.fuente !== null && input.fuente !== '') {
    const fuente = String(input.fuente).trim();
    if (!FUENTES.includes(fuente as FuenteEntrada)) throw new Error('fuente invalida');
    fila.fuente = fuente;
  }

  const sb = clienteActual();
  const { data, error } = await sb.from('os_journal').insert([fila]).select().single();
  if (error) throw error;
  return data as EntradaJournal;
}

export async function actualizarEntrada(id: string | null, input: EntradaInput): Promise<EntradaJournal> {
  if (!id) throw new Error('id requerido');
  const patch: Record<string, unknown> = {};

  if (typeof input.contenido === 'string') {
    const contenido = input.contenido.trim();
    if (!contenido) throw new Error('contenido requerido');
    patch.contenido = contenido;
  }
  if ('titulo' in input) patch.titulo = textoOpcional(input.titulo);
  if ('proyecto' in input) patch.proyecto = textoOpcional(input.proyecto);
  if ('tags' in input) patch.tags = normalizarTags(input.tags);
  if ('publicable' in input) patch.publicable = input.publicable === true;
  if ('mood' in input) patch.mood = textoOpcional(input.mood);
  if ('tipo' in input) {
    const tipo = String(input.tipo ?? '').trim();
    if (!TIPOS.includes(tipo as TipoEntrada)) throw new Error('tipo invalido');
    patch.tipo = tipo;
  }
  if ('fecha' in input) {
    const fecha = String(input.fecha ?? '').trim();
    if (!FECHA_RE.test(fecha)) throw new Error('fecha invalida: usa YYYY-MM-DD');
    patch.fecha = fecha;
  }

  if (!Object.keys(patch).length) throw new Error('sin campos para actualizar');

  const sb = clienteActual();
  const { data, error } = await sb.from('os_journal').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as EntradaJournal;
}

export interface SugerenciasJournal {
  tareas: string[];
  personas: string[];
}

/** Heuristica conservadora: solo ofrece, nunca crea registros automaticamente. */
export function detectarSugerencias(contenido: string): SugerenciasJournal {
  const texto = contenido.trim();
  const tareas = [...texto.matchAll(/\b(?:debo|tengo que|pendiente(?:s)?|recordar|hacer)\s+([^.!?\n]{3,100})/gi)]
    .map((m) => m[1].trim().replace(/[,:;]+$/, ''))
    .filter((v, i, a) => v.length >= 3 && a.indexOf(v) === i)
    .slice(0, 5);
  const personas = [...texto.matchAll(/(?:^|[\s,(])@([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ-]{2,40})/g)]
    .map((m) => m[1].trim())
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);
  return { tareas, personas };
}

export async function eliminarEntrada(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_journal').delete().eq('id', id);
  if (error) throw error;
}

// --- Puente al organo de contenido ------------------------------------------
//
// El organo de contenido (src/organs/contenido/server/ideas.handlers.ts)
// escribe en os_contenido_ideas. Aca se insertan las mismas columnas con el
// mismo cliente inyectable para que el test cubra el puente sin duplicar la
// logica de negocio de ideas: el journal solo aporta el titulo, la idea madre y
// el vinculo de vuelta a la entrada.

export interface IdeaDesdeJournal {
  id: string;
  titulo: string;
  idea_madre: string | null;
  status: string;
}

export async function promoverAContenido(id: string | null): Promise<{ entrada: EntradaJournal; idea: IdeaDesdeJournal }> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();

  const { data: entrada, error: errorEntrada } = await sb.from('os_journal').select('*').eq('id', id).single();
  if (errorEntrada) throw errorEntrada;
  if (!entrada) throw new Error('entrada no encontrada');

  const fila = entrada as EntradaJournal;
  const titulo = (fila.titulo?.trim() || fila.contenido.trim().split('\n')[0] || 'Entrada de diario').slice(0, 200);

  const { data: idea, error: errorIdea } = await sb
    .from('os_contenido_ideas')
    .insert([{
      titulo,
      formato: null,
      // El vinculo de vuelta va en idea_madre: es el campo de texto libre que
      // ya usa el pipeline para explicar de donde salio la idea, y evita
      // agregar una columna nueva a os_contenido_ideas solo para esto.
      idea_madre: `Diario ${fila.fecha} (${fila.tipo}) · journal:${fila.id}\n\n${fila.contenido}`,
      repurposing: [],
      status: 'idea',
      plataformas: [],
      fecha_target: null,
    }])
    .select()
    .single();
  if (errorIdea) throw errorIdea;

  // Promover implica que la entrada ES materia prima de contenido.
  const { data: actualizada, error: errorUpdate } = await sb
    .from('os_journal')
    .update({ publicable: true })
    .eq('id', fila.id)
    .select()
    .single();
  if (errorUpdate) throw errorUpdate;

  return { entrada: actualizada as EntradaJournal, idea: idea as IdeaDesdeJournal };
}

// --- Sincronizacion al brain -------------------------------------------------

const TIPO_LABEL: Record<TipoEntrada, string> = {
  dia: 'Dia',
  proceso: 'Proceso',
  decision: 'Decision',
  win: 'Win',
  idea: 'Idea',
};

export function slugDelDia(fecha: string): string {
  if (!FECHA_RE.test(fecha)) throw new Error('fecha invalida: usa YYYY-MM-DD');
  return `diario-${fecha}`;
}

// Arma la pagina de gbrain de un dia. Cumple las reglas de escritura del brain:
// al menos un wikilink en el cuerpo y cierre con "Relacionado:".
export function componerMarkdownDia(fecha: string, entradas: EntradaJournal[]): string {
  const lineas: string[] = [];
  lineas.push(`# Diario ${fecha}`);
  lineas.push('');
  lineas.push(`Bitacora del dia registrada en [[pancho-os]]. ${entradas.length} entrada(s).`);
  lineas.push('');

  for (const tipo of TIPOS) {
    const delTipo = entradas.filter((e) => e.tipo === tipo);
    if (!delTipo.length) continue;
    lineas.push(`## ${TIPO_LABEL[tipo]}`);
    lineas.push('');
    for (const e of delTipo) {
      const encabezado = [e.titulo?.trim(), e.proyecto ? `(${e.proyecto})` : null].filter(Boolean).join(' ');
      if (encabezado) lineas.push(`### ${encabezado}`);
      lineas.push(e.contenido.trim());
      const meta = [
        e.tags.length ? `tags: ${e.tags.join(', ')}` : null,
        e.publicable ? 'publicable' : null,
        e.mood ? `mood: ${e.mood}` : null,
        `fuente: ${e.fuente}`,
      ].filter(Boolean).join(' · ');
      lineas.push('');
      lineas.push(`_${meta}_`);
      lineas.push('');
    }
  }

  lineas.push('Relacionado: [[pancho-os]] [[hermes]]');
  return lineas.join('\n');
}

export async function marcarBrainSlug(fecha: string, slug: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('os_journal').update({ brain_slug: slug }).eq('fecha', fecha);
  if (error) throw error;
}
