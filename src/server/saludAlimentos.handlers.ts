// Logica de /api/salud/alimentos, portada de src/pages/api/salud/alimentos.ts.
//
// Catalogo de alimentos: busqueda por texto (RPC buscar_alimentos), por codigo
// de barras (local, con respaldo en Open Food Facts) y atajos del picker
// (recientes / frecuentes / favoritos). Comportamiento identico al de Astro;
// los unicos cambios son de plomeria: getSupabaseServer de src/server/, readEnv
// en vez de import.meta.env, y ErrorHttp en vez de devolver Response desde aca.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull } from '../lib/salud/apiHelpers.ts';
import { readEnv } from '../lib/env.ts';

const FUENTES = ['personal', 'off', 'usda', 'latam'];
const MODOS = ['recientes', 'frecuentes', 'favoritos'];

// Adjunta alimento_porciones (tabla relacional) embebidas en cada fila de alimento,
// para que el picker de porciones estilo Yazio no necesite un fetch aparte.
async function conPorciones(sb: SupabaseClient, alimentos: Array<Record<string, unknown>>) {
  if (!alimentos.length) return alimentos;
  const ids = [...new Set(alimentos.map((a) => a.id as string))];
  const { data: porciones, error } = await sb
    .from('alimento_porciones')
    .select('*')
    .in('alimento_id', ids)
    .order('orden', { ascending: true });
  if (error) throw error;
  const porAlimento = new Map<string, unknown[]>();
  for (const p of porciones ?? []) {
    const lista = porAlimento.get(p.alimento_id) ?? [];
    lista.push(p);
    porAlimento.set(p.alimento_id, lista);
  }
  return alimentos.map((a) => ({
    ...a,
    alimento_porciones: porAlimento.get(a.id as string) ?? [],
  }));
}

interface OffProduct {
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  serving_size?: string;
}

// Normaliza un producto de Open Food Facts a nuestro esquema (macros por 100 g).
function normalizarOff(barcode: string, p: OffProduct) {
  const n = p.nutriments ?? {};
  const nombre = (p.product_name_es || p.product_name || `Producto ${barcode}`).trim();
  return {
    nombre,
    marca: p.brands?.split(',')[0]?.trim() || null,
    barcode,
    fuente: 'off' as const,
    kcal: numOrNull(n['energy-kcal_100g']) ?? 0,
    proteina_g: numOrNull(n['proteins_100g']) ?? 0,
    carbos_g: numOrNull(n['carbohydrates_100g']) ?? 0,
    grasa_g: numOrNull(n['fat_100g']) ?? 0,
    fibra_g: numOrNull(n['fiber_100g']),
    porciones: [] as Array<{ medida: string; gramos: number }>,
  };
}

export async function buscarAlimentos(params: {
  q: string;
  barcode: string;
  modo: string;
}): Promise<Record<string, unknown>> {
  const { q, barcode, modo } = params;
  const sb = getSupabaseServer();

  // 0. Atajos de picker: recientes/frecuentes/favoritos (excluyentes con q/barcode).
  if (modo) {
    if (!MODOS.includes(modo)) {
      throw error400(`modo debe ser uno de: ${MODOS.join(', ')}`);
    }
    let query = sb.from('alimentos').select('*').limit(30);
    if (modo === 'recientes') {
      query = query.not('ultima_vez', 'is', null).order('ultima_vez', { ascending: false });
    } else if (modo === 'frecuentes') {
      query = query.gt('veces_usado', 0).order('veces_usado', { ascending: false });
    } else {
      query = query.eq('favorito', true).order('nombre', { ascending: true });
    }
    const { data, error } = await query;
    if (error) throw error;
    const alimentos = await conPorciones(sb, data ?? []);
    return { alimentos, fuente: 'local', modo };
  }

  // 1. Búsqueda por barcode: primero local, si no está consulta Open Food Facts.
  if (barcode) {
    const { data: local, error } = await sb
      .from('alimentos')
      .select('*')
      .eq('barcode', barcode)
      .limit(1);
    if (error) throw error;
    if (local && local.length) {
      return { alimentos: await conPorciones(sb, local), fuente: 'local' };
    }

    // Consulta Open Food Facts server-side. El try/catch solo cubre la red de OFF;
    // el insert local queda FUERA para que un error de DB no se disfrace de "no encontrado".
    const contacto = readEnv('OFF_CONTACT_EMAIL') || 'contacto-no-configurado';
    let producto: OffProduct | null = null;
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        { headers: { 'User-Agent': `PanchoOS/1.0 (${contacto})` } },
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.status === 1 && data?.product) producto = data.product as OffProduct;
      }
    } catch {
      // OFF no disponible: devolvemos vacío sin crashear.
    }
    if (producto) {
      const nuevo = normalizarOff(barcode, producto);
      const { data: guardado, error: insErr } = await sb
        .from('alimentos')
        .insert([nuevo])
        .select()
        .single();
      if (insErr) throw insErr;
      return { alimentos: [{ ...guardado, alimento_porciones: [] }], fuente: 'off' };
    }
    return { alimentos: [], fuente: 'off_no_encontrado' };
  }

  // 2. Búsqueda por texto: RPC buscar_alimentos (unaccent, parametrizado). Insensible a
  // acentos y sin romper términos con paréntesis. term vacío/null => primeros 40 por nombre.
  const { data, error } = await sb.rpc('buscar_alimentos', { term: q || null, lim: 40 });
  if (error) throw error;
  const alimentos = await conPorciones(sb, data ?? []);
  return { alimentos, fuente: 'local' };
}

export async function crearAlimento(body: Record<string, any>) {
  if (!body.nombre?.trim()) throw error400('nombre requerido');
  const fuente = body.fuente?.trim() || 'personal';
  if (!FUENTES.includes(fuente)) {
    throw error400(`fuente debe ser una de: ${FUENTES.join(', ')}`);
  }
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('alimentos')
    .insert([{
      nombre: body.nombre.trim(),
      marca: body.marca?.trim() || null,
      barcode: body.barcode?.trim() || null,
      fuente,
      kcal: numOrNull(body.kcal) ?? 0,
      proteina_g: numOrNull(body.proteina_g) ?? 0,
      carbos_g: numOrNull(body.carbos_g) ?? 0,
      grasa_g: numOrNull(body.grasa_g) ?? 0,
      fibra_g: numOrNull(body.fibra_g),
      porciones: Array.isArray(body.porciones) ? body.porciones : [],
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarAlimento(id: string, body: Record<string, any>) {
  if (!('favorito' in body)) throw error400('favorito requerido');
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('alimentos')
    .update({ favorito: !!body.favorito, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarAlimento(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('alimentos').delete().eq('id', id);
  if (error) throw error;
}
