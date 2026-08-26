// Logica pura de os_dia + os_wins: One Domino + Discomfort First del dia y wins.
//
// Extraida de src/pages/api/dia.ts (Astro) para reusarse desde la server route
// de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from './helpers.ts';
import { readEnv } from '../lib/env.ts';
import { createGbrainClient } from '../os/lib/gbrain.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer; los
// tests inyectan un doble en memoria y no tocan Supabase real.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseDia(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

const CAMPOS_DIA = [
  'domino_titulo', 'domino_linea', 'domino_razon', 'domino_hecho',
  'discomfort_titulo', 'discomfort_hecho', 'nota',
] as const;

export interface Dia {
  id: string;
  fecha: string;
  domino_titulo: string | null;
  domino_linea: string | null;
  domino_razon: string | null;
  domino_hecho: boolean;
  discomfort_titulo: string | null;
  discomfort_hecho: boolean;
  nota: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Win {
  id: string;
  fecha: string;
  texto: string;
  categoria: string | null;
  created_at: string;
}

export interface DiaResultado {
  dia: Dia | null;
  wins: Win[];
}

export async function obtenerDia(fecha?: string | null): Promise<DiaResultado> {
  const fechaQuery = fecha || hoyGuayaquil();
  const sb = clienteActual();

  const { data: dia, error: errDia } = await sb
    .from('os_dia')
    .select('*')
    .eq('fecha', fechaQuery)
    .maybeSingle();
  if (errDia) throw errDia;

  const { data: wins, error: errWins } = await sb
    .from('os_wins')
    .select('*')
    .eq('fecha', fechaQuery)
    .order('created_at', { ascending: true });
  if (errWins) throw errWins;

  return { dia: (dia as Dia | null) ?? null, wins: (wins as Win[] | null) ?? [] };
}

export async function upsertDia(patchRaw: Record<string, unknown>): Promise<Dia> {
  const fecha = (patchRaw.fecha as string | undefined) || hoyGuayaquil();
  const patch: Record<string, unknown> = { fecha, updated_at: new Date().toISOString() };
  for (const c of CAMPOS_DIA) {
    if (c in patchRaw) patch[c] = patchRaw[c];
  }

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_dia')
    .upsert(patch, { onConflict: 'fecha' })
    .select()
    .single();
  if (error) throw error;
  return data as Dia;
}

export async function crearWin(
  fecha: string | null | undefined,
  win: { texto?: string; categoria?: string | null },
): Promise<Win> {
  const texto = typeof win.texto === 'string' ? win.texto.trim() : '';
  if (!texto) throw new Error('win.texto requerido');
  const fechaQuery = fecha || hoyGuayaquil();

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_wins')
    .insert([{
      fecha: fechaQuery,
      texto,
      categoria: win.categoria ?? null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data as Win;
}

export async function eliminarWin(winId: string | null | undefined): Promise<void> {
  if (!winId) throw new Error('win_id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_wins').delete().eq('id', winId);
  if (error) throw error;
}

// --- Sugerencia de domino ---------------------------------------------------
//
// Lee lo mas reciente del brain para proponer sobre que podria ir el domino de
// hoy. NO escribe nada en os_dia: son candidatos para prellenar el formulario,
// y Pancho sigue teniendo que confirmar con Guardar.
//
// Son temas, no dominos ya redactados: el titulo de una pagina del brain es una
// señal de sobre que se viene hablando, no una accion concreta. La UI los
// presenta como tal y el texto queda editable.

const SUGERENCIAS_MAX = 3;
const PAGINAS_A_MIRAR = 12;

export interface SugerenciaDomino {
  texto: string;
  slug: string;
}

export async function sugerirDomino(): Promise<SugerenciaDomino[]> {
  // Sin token no es un error: el OS funciona igual, solo que sin sugerencia.
  const token = readEnv('GBRAIN_TOKEN');
  if (!token) return [];

  const paginas = await createGbrainClient(token)
    .listPages({ sort: 'updated_desc', limit: PAGINAS_A_MIRAR });

  const vistos = new Set<string>();
  const sugerencias: SugerenciaDomino[] = [];
  for (const p of paginas) {
    const texto = (p.title ?? '').trim();
    if (!texto) continue;
    const clave = texto.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    sugerencias.push({ texto, slug: p.slug });
    if (sugerencias.length >= SUGERENCIAS_MAX) break;
  }
  return sugerencias;
}
