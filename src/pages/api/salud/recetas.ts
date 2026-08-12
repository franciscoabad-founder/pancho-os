export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull } from '../../../lib/salud/apiHelpers';

const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers de parseo JSON-LD (schema.org/Recipe). Sin dependencias nuevas.
// ---------------------------------------------------------------------------

interface RecetaImportada {
  nombre: string;
  descripcion: string | null;
  porciones: number | null;
  tiempo_min: number | null;
  instrucciones: string[];
  foto_url: string | null;
  ingredientes: string[];
  kcal: number | null;
  proteina_g: number | null;
  carbos_g: number | null;
  grasa_g: number | null;
}

/** Extrae y parsea todos los bloques <script type="application/ld+json">. */
function extraerBloquesJsonLd(html: string): unknown[] {
  const bloques: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const contenido = m[1].trim();
    if (!contenido) continue;
    try {
      bloques.push(JSON.parse(contenido));
    } catch {
      // Bloque JSON-LD malformado: se ignora, no rompe el resto del parseo.
    }
  }
  return bloques;
}

/** Aplana @graph y arrays anidados en una lista plana de nodos JSON-LD. */
function aplanarNodos(bloques: unknown[]): Record<string, unknown>[] {
  const nodos: Record<string, unknown>[] = [];
  const visitar = (n: unknown) => {
    if (Array.isArray(n)) {
      for (const x of n) visitar(x);
      return;
    }
    if (n && typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      if (Array.isArray(obj['@graph'])) {
        visitar(obj['@graph']);
        return;
      }
      nodos.push(obj);
    }
  };
  for (const b of bloques) visitar(b);
  return nodos;
}

/** true si el nodo declara @type Recipe (string o array de strings). */
function esRecipe(nodo: Record<string, unknown>): boolean {
  const tipo = nodo['@type'];
  if (typeof tipo === 'string') return tipo.toLowerCase() === 'recipe';
  if (Array.isArray(tipo)) return tipo.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
  return false;
}

/** Convierte una duracion ISO 8601 (ej. "PT1H30M") a minutos. null si no parsea. */
function parseDuracionISO8601(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const horas = Number(m[1] || 0);
  const minutos = Number(m[2] || 0);
  const segundos = Number(m[3] || 0);
  const total = horas * 60 + minutos + Math.round(segundos / 60);
  return total > 0 ? total : null;
}

/** Quita unidades de un valor de nutricion (ej. "12 g" -> 12, "270 calories" -> 270). */
function parseNumeroNutricion(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Extrae el primer entero de recipeYield (puede ser "4 servings", ["4"], 4). */
function parseRecipeYield(v: unknown): number | null {
  if (v == null) return null;
  const valor = Array.isArray(v) ? v[0] : v;
  if (typeof valor === 'number') return Math.round(valor);
  const m = String(valor).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Mapea recipeInstructions: string, string[], HowToStep[] o HowToSection[] con pasos anidados. */
function mapearInstrucciones(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') {
    // Instrucciones en un solo bloque de texto: se separan por salto de linea.
    return v.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  }
  const pasos: string[] = [];
  const visitar = (item: unknown) => {
    if (typeof item === 'string') {
      pasos.push(item.trim());
    } else if (Array.isArray(item)) {
      for (const x of item) visitar(x);
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if (Array.isArray(obj.itemListElement)) {
        visitar(obj.itemListElement);
      } else if (typeof obj.text === 'string') {
        pasos.push(obj.text.trim());
      } else if (typeof obj.name === 'string') {
        pasos.push(obj.name.trim());
      }
    }
  };
  visitar(v);
  return pasos.filter(Boolean);
}

/** Extrae la primera imagen de recipeImage (string, array de strings, o ImageObject). */
function mapearImagen(v: unknown): string | null {
  if (v == null) return null;
  const valor = Array.isArray(v) ? v[0] : v;
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object' && typeof (valor as Record<string, unknown>).url === 'string') {
    return (valor as Record<string, unknown>).url as string;
  }
  return null;
}

/** Convierte un nodo JSON-LD Recipe al esquema interno de `recetas`. */
function mapearRecipeJsonLd(nodo: Record<string, unknown>): RecetaImportada {
  const nutrition = (nodo.nutrition ?? {}) as Record<string, unknown>;
  return {
    nombre: String(nodo.name ?? '').trim(),
    descripcion: typeof nodo.description === 'string' ? nodo.description.trim() : null,
    porciones: parseRecipeYield(nodo.recipeYield),
    tiempo_min: parseDuracionISO8601(nodo.totalTime) ?? parseDuracionISO8601(nodo.cookTime),
    instrucciones: mapearInstrucciones(nodo.recipeInstructions),
    foto_url: mapearImagen(nodo.image),
    ingredientes: Array.isArray(nodo.recipeIngredient)
      ? nodo.recipeIngredient.filter((x): x is string => typeof x === 'string')
      : [],
    kcal: parseNumeroNutricion(nutrition.calories),
    proteina_g: parseNumeroNutricion(nutrition.proteinContent),
    carbos_g: parseNumeroNutricion(nutrition.carbohydrateContent),
    grasa_g: parseNumeroNutricion(nutrition.fatContent),
  };
}

/** Descarga una URL con timeout y devuelve la primera Recipe JSON-LD encontrada. */
async function importarRecetaDeUrl(url: string): Promise<RecetaImportada> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PanchoOS/1.0 (importador de recetas)' },
    });
    if (!res.ok) throw new Error(`No se pudo descargar la URL: HTTP ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timeoutId);
  }

  const nodos = aplanarNodos(extraerBloquesJsonLd(html));
  const recipe = nodos.find(esRecipe);
  if (!recipe) {
    throw new Error('No se encontró un bloque Recipe (JSON-LD) en la URL.');
  }
  const mapeada = mapearRecipeJsonLd(recipe);
  if (!mapeada.nombre) {
    throw new Error('El bloque Recipe no tiene nombre (name).');
  }
  return mapeada;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  const id = url.searchParams.get('id');
  try {
    const sb = getSupabaseServer();

    if (id) {
      const { data: receta, error } = await sb.from('recetas').select('*').eq('id', id).single();
      if (error) throw error;
      const { data: ingredientes, error: errIng } = await sb
        .from('receta_ingredientes')
        .select('*')
        .eq('receta_id', id)
        .order('orden', { ascending: true });
      if (errIng) throw errIng;
      return json({ receta: { ...receta, ingredientes: ingredientes ?? [] } });
    }

    const q = url.searchParams.get('q')?.trim() || '';
    const fuente = url.searchParams.get('fuente')?.trim() || '';
    const tagsParam = url.searchParams.get('tags')?.trim() || '';
    const limit = Math.min(200, Math.max(1, numOrNull(url.searchParams.get('limit')) ?? 40));
    const offset = Math.max(0, numOrNull(url.searchParams.get('offset')) ?? 0);

    let query = sb.from('recetas').select('*').order('nombre', { ascending: true });
    if (q) query = query.ilike('nombre', `%${q}%`);
    if (fuente) query = query.eq('fuente', fuente);
    if (tagsParam) {
      const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length) query = query.overlaps('tags', tags);
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return json({ recetas: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();

    // Rama de importación: POST { importar_url }.
    if (body.importar_url?.trim()) {
      const sourceUrl = body.importar_url.trim();
      let importada: RecetaImportada;
      try {
        importada = await importarRecetaDeUrl(sourceUrl);
      } catch (err) {
        return json({ error: errMsg(err) }, 422);
      }
      const sb = getSupabaseServer();
      const { data: receta, error } = await sb
        .from('recetas')
        .insert([{
          nombre: importada.nombre,
          descripcion: importada.descripcion,
          porciones: importada.porciones ?? 1,
          tiempo_min: importada.tiempo_min,
          instrucciones: importada.instrucciones,
          foto_url: importada.foto_url,
          fuente: 'import',
          fuente_url: sourceUrl,
          kcal: importada.kcal,
          proteina_g: importada.proteina_g,
          carbos_g: importada.carbos_g,
          grasa_g: importada.grasa_g,
          tags: [],
        }])
        .select()
        .single();
      if (error) throw error;

      if (importada.ingredientes.length) {
        const filas = importada.ingredientes.map((descripcion, i) => ({
          receta_id: receta.id,
          orden: i,
          descripcion,
        }));
        const { error: errIng } = await sb.from('receta_ingredientes').insert(filas);
        if (errIng) throw errIng;
      }

      return json({ receta, ingredientes_importados: importada.ingredientes.length }, 201);
    }

    // Rama normal: crear receta propia.
    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const sb = getSupabaseServer();
    const { data: receta, error } = await sb
      .from('recetas')
      .insert([{
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        porciones: numOrNull(body.porciones) ?? 1,
        tiempo_min: numOrNull(body.tiempo_min),
        instrucciones: Array.isArray(body.instrucciones) ? body.instrucciones : [],
        foto_url: body.foto_url?.trim() || null,
        fuente: body.fuente?.trim() || 'propia',
        fuente_url: body.fuente_url?.trim() || null,
        kcal: numOrNull(body.kcal),
        proteina_g: numOrNull(body.proteina_g),
        carbos_g: numOrNull(body.carbos_g),
        grasa_g: numOrNull(body.grasa_g),
        tags: Array.isArray(body.tags) ? body.tags : [],
      }])
      .select()
      .single();
    if (error) throw error;

    // Ingredientes opcionales en la misma llamada: [{ descripcion, alimento_id?, cantidad_g? }].
    if (Array.isArray(body.ingredientes) && body.ingredientes.length) {
      const filas = body.ingredientes.map((ing: Record<string, unknown>, i: number) => ({
        receta_id: receta.id,
        orden: i,
        descripcion: String(ing.descripcion ?? '').trim(),
        alimento_id: ing.alimento_id || null,
        cantidad_g: numOrNull(ing.cantidad_g),
      })).filter((f: { descripcion: string }) => f.descripcion);
      if (filas.length) {
        const { error: errIng } = await sb.from('receta_ingredientes').insert(filas);
        if (errIng) throw errIng;
      }
    }

    return json({ receta }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of ['nombre', 'descripcion', 'foto_url', 'fuente', 'fuente_url']) {
      if (c in body) patch[c] = typeof body[c] === 'string' ? body[c].trim() || null : body[c];
    }
    for (const c of ['porciones', 'tiempo_min', 'kcal', 'proteina_g', 'carbos_g', 'grasa_g']) {
      if (c in body) patch[c] = numOrNull(body[c]);
    }
    if ('instrucciones' in body) patch.instrucciones = Array.isArray(body.instrucciones) ? body.instrucciones : [];
    if ('tags' in body) patch.tags = Array.isArray(body.tags) ? body.tags : [];

    const sb = getSupabaseServer();
    const { data, error } = await sb.from('recetas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ receta: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('recetas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
