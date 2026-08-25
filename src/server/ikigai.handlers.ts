// Logica del modulo Ikigai (tablas os_ikigai_mapas/items/zonas/pulsos).
//
// Mismo patron que journal.handlers.ts: nada de este archivo conoce Astro,
// TanStack Start, Request ni Response. Cliente de Supabase inyectable para
// tests en memoria.
//
// Este handler es intencionalmente el UNICO archivo del modulo que conoce al
// resto del OS ("puente"): la logica de dominio real (clasificar, cobertura,
// comparar, tendencia) vive en src/lib/ikigai/ y no importa nada de aca. Eso
// es lo que permite extraer src/lib/ikigai/ a Nerio sin tocar una linea.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { CUADRANTES, esCuadrante, type Cuadrante } from '../lib/ikigai/cuadrantes.ts';
import { clasificar, type Clasificacion } from '../lib/ikigai/zonas.ts';
import { cobertura, type Cobertura } from '../lib/ikigai/cobertura.ts';
import { comparar, type Deriva } from '../lib/ikigai/deriva.ts';
import { tendencia, type Tendencia, type Pulso as PulsoDominio } from '../lib/ikigai/pulso.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseIkigai(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface Mapa {
  id: string;
  version: number;
  titulo: string | null;
  nota: string | null;
  activo: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  mapa_id: string;
  cuadrante: Cuadrante;
  texto: string;
  orden: number;
  created_at: string;
}

export interface Zona {
  id: string;
  mapa_id: string;
  nombre: string;
  cuadrantes: Cuadrante[];
  descripcion: string | null;
  objetivo_ref: string | null;
  orden: number;
  created_at: string;
}

export interface ZonaConClasificacion extends Zona {
  clasificacion: Clasificacion;
}

export interface EstadoIkigai {
  mapa: Mapa | null;
  items: Item[];
  zonas: ZonaConClasificacion[];
  cobertura: Cobertura;
}

function textoRequerido(v: unknown, campo: string): string {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) throw new Error(`${campo} requerido`);
  return t;
}

function textoOpcional(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function cuadrantesDesdeInput(v: unknown): Cuadrante[] {
  if (!Array.isArray(v)) return [];
  const unicos = new Set<Cuadrante>();
  for (const c of v) {
    if (esCuadrante(c)) unicos.add(c);
  }
  return Array.from(unicos);
}

// --- Mapa activo -------------------------------------------------------

export async function obtenerMapaActivo(): Promise<Mapa | null> {
  const sb = clienteActual();
  const { data, error } = await sb.from('os_ikigai_mapas').select('*').eq('activo', true).maybeSingle();
  if (error) throw error;
  return (data as Mapa | null) ?? null;
}

/** Crea un mapa NUEVO como version siguiente y lo marca activo, desactivando
 *  el anterior. La version anterior queda intacta para comparar (deriva).
 *
 *  Por defecto (copiarAnterior=true) los items y zonas del mapa anterior se
 *  COPIAN al nuevo: rediagnosticar es "continuar y ajustar", no "empezar de
 *  cero". Un usuario que ya cargo 30 frases no espera que desaparezcan al
 *  tocar "Rediagnosticar" -- eso fue exactamente el bug reportado. Pasar
 *  copiarAnterior=false solo para el primer mapa o si el usuario pide
 *  explicitamente empezar en blanco. */
export async function crearNuevoMapa(titulo?: unknown, nota?: unknown, copiarAnterior = true): Promise<Mapa> {
  const sb = clienteActual();
  const previo = await obtenerMapaActivo();

  if (previo) {
    const { error: errDesactivar } = await sb.from('os_ikigai_mapas').update({ activo: false }).eq('id', previo.id);
    if (errDesactivar) throw errDesactivar;
  }

  const { data, error } = await sb
    .from('os_ikigai_mapas')
    .insert([{ version: (previo?.version ?? 0) + 1, titulo: textoOpcional(titulo), nota: textoOpcional(nota), activo: true }])
    .select()
    .single();
  if (error) throw error;
  const nuevo = data as Mapa;

  if (previo && copiarAnterior) {
    const [{ data: items }, { data: zonas }] = await Promise.all([
      sb.from('os_ikigai_items').select('cuadrante, texto, orden').eq('mapa_id', previo.id),
      sb.from('os_ikigai_zonas').select('nombre, cuadrantes, descripcion, objetivo_ref, orden').eq('mapa_id', previo.id),
    ]);
    if (items?.length) {
      const copia = items.map((i) => ({ ...i, mapa_id: nuevo.id }));
      const { error: errItems } = await sb.from('os_ikigai_items').insert(copia);
      if (errItems) throw errItems;
    }
    if (zonas?.length) {
      const copia = zonas.map((z) => ({ ...z, mapa_id: nuevo.id }));
      const { error: errZonas } = await sb.from('os_ikigai_zonas').insert(copia);
      if (errZonas) throw errZonas;
    }
  }

  return nuevo;
}

// --- Items --------------------------------------------------------------

export async function agregarItem(mapaId: string | null, cuadrante: unknown, texto: unknown): Promise<Item> {
  if (!mapaId) throw new Error('mapa_id requerido');
  if (!esCuadrante(cuadrante)) throw new Error(`cuadrante invalido: usa ${CUADRANTES.join('|')}`);
  const t = textoRequerido(texto, 'texto');

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_ikigai_items')
    .insert([{ mapa_id: mapaId, cuadrante, texto: t }])
    .select()
    .single();
  if (error) throw error;
  return data as Item;
}

export async function eliminarItem(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_ikigai_items').delete().eq('id', id);
  if (error) throw error;
}

// --- Zonas ----------------------------------------------------------------

export async function crearZona(mapaId: string | null, nombre: unknown, cuadrantes: unknown, descripcion?: unknown): Promise<Zona> {
  if (!mapaId) throw new Error('mapa_id requerido');
  const n = textoRequerido(nombre, 'nombre');
  const cs = cuadrantesDesdeInput(cuadrantes);

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_ikigai_zonas')
    .insert([{ mapa_id: mapaId, nombre: n, cuadrantes: cs, descripcion: textoOpcional(descripcion) }])
    .select()
    .single();
  if (error) throw error;
  return data as Zona;
}

export async function actualizarZona(id: string | null, cuadrantes: unknown): Promise<Zona> {
  if (!id) throw new Error('id requerido');
  const cs = cuadrantesDesdeInput(cuadrantes);
  const sb = clienteActual();
  const { data, error } = await sb.from('os_ikigai_zonas').update({ cuadrantes: cs }).eq('id', id).select().single();
  if (error) throw error;
  return data as Zona;
}

export async function eliminarZona(id: string | null): Promise<void> {
  if (!id) throw new Error('id requerido');
  const sb = clienteActual();
  const { error } = await sb.from('os_ikigai_zonas').delete().eq('id', id);
  if (error) throw error;
}

// --- Estado completo (lo que consume la pantalla de Mapa) -------------------

export async function obtenerEstado(): Promise<EstadoIkigai> {
  const mapa = await obtenerMapaActivo();
  if (!mapa) return { mapa: null, items: [], zonas: [], cobertura: cobertura([]) };

  const sb = clienteActual();
  const [{ data: items, error: errItems }, { data: zonas, error: errZonas }] = await Promise.all([
    sb.from('os_ikigai_items').select('*').eq('mapa_id', mapa.id).order('orden'),
    sb.from('os_ikigai_zonas').select('*').eq('mapa_id', mapa.id).order('orden'),
  ]);
  if (errItems) throw errItems;
  if (errZonas) throw errZonas;

  const zonasTyped = (zonas ?? []) as Zona[];
  const zonasConClasificacion: ZonaConClasificacion[] = zonasTyped.map((z) => ({
    ...z,
    clasificacion: clasificar(z.cuadrantes),
  }));

  return {
    mapa,
    items: (items ?? []) as Item[],
    zonas: zonasConClasificacion,
    cobertura: cobertura(zonasTyped),
  };
}

// --- Pulso mensual --------------------------------------------------------

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function registrarPulso(zonaId: string | null, periodo: unknown, nivel: unknown, nota?: unknown): Promise<void> {
  if (!zonaId) throw new Error('zona_id requerido');
  const p = String(periodo ?? '').trim();
  if (!PERIODO_RE.test(p)) throw new Error('periodo invalido: usa YYYY-MM');
  const n = Number(nivel);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('nivel invalido: usa un entero 1-5');

  const sb = clienteActual();
  const { error } = await sb
    .from('os_ikigai_pulsos')
    .upsert([{ zona_id: zonaId, periodo: p, nivel: n, nota: textoOpcional(nota) }], { onConflict: 'zona_id,periodo' });
  if (error) throw error;
}

export async function tendenciaDeZona(zonaId: string | null, ventana = 6): Promise<Tendencia> {
  if (!zonaId) throw new Error('zona_id requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_ikigai_pulsos')
    .select('periodo, nivel')
    .eq('zona_id', zonaId)
    .order('periodo', { ascending: false })
    .limit(ventana);
  if (error) throw error;
  return tendencia((data ?? []) as PulsoDominio[], ventana);
}

// --- Deriva entre versiones -------------------------------------------------

export async function derivaEntreMapas(mapaAnteriorId: string | null, mapaActualId: string | null): Promise<Deriva> {
  if (!mapaAnteriorId || !mapaActualId) throw new Error('mapaAnteriorId y mapaActualId requeridos');
  const sb = clienteActual();
  const [{ data: anterior, error: e1 }, { data: actual, error: e2 }] = await Promise.all([
    sb.from('os_ikigai_items').select('id, texto, cuadrante').eq('mapa_id', mapaAnteriorId),
    sb.from('os_ikigai_items').select('id, texto, cuadrante').eq('mapa_id', mapaActualId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return comparar(anterior ?? [], actual ?? []);
}

export async function listarMapas(): Promise<Mapa[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('os_ikigai_mapas').select('*').order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Mapa[];
}
