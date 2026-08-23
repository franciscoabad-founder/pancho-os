// Logica de /api/salud/cuerpo, portada de src/pages/api/salud/cuerpo.ts.
//
import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';
import { numOrNull, hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { registrarEvento } from '../lib/juego/motor.ts';

//
// OVERLAP DE PESO CORPORAL: peso_kg vive tambien en biometricas_dia
// (/api/biometricas, espejo diario de Google Health via n8n). Regla de lectura
// acordada: cuerpo_log manda, biometricas_dia rellena los dias sin medicion
// propia. Igual criterio que el sueno en src/lib/sueno/estado.ts.
// La regla ya esta implementada y testeada en src/lib/salud/peso.ts. Este
// endpoint NO la aplica todavia: el port a TanStack Start se hizo a contrato
// congelado (misma respuesta byte a byte) para no mezclar migracion con cambio
// de comportamiento. Cablear pesoDelDia/ultimoPesoConocido/serieDePeso aca es
// un cambio aparte, con su propia verificacion contra el UI que lo consume.
const SOURCES = ['manual', 'renpho', 'fitbit'];

export async function listarMediciones() {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('cuerpo_log')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(365);
  if (error) throw error;
  return data ?? [];
}

export async function crearMedicion(body: Record<string, any>) {
  const source = body.source?.trim() || 'manual';
  if (!SOURCES.includes(source)) throw error400(`source debe ser: ${SOURCES.join(', ')}`);
  // Cualquier medición cuenta, incluido solo sueño (alimenta la regla de recuperación).
  const MEDICIONES = ['peso_kg', 'grasa_pct', 'musculo_kg', 'agua_pct', 'cintura_cm', 'sueno_horas'];
  if (MEDICIONES.every((f) => numOrNull(body[f]) == null)) {
    throw error400('al menos una medición requerida');
  }
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('cuerpo_log')
    .insert([{
      fecha: body.fecha?.trim() || hoyGuayaquil(),
      peso_kg: numOrNull(body.peso_kg),
      grasa_pct: numOrNull(body.grasa_pct),
      musculo_kg: numOrNull(body.musculo_kg),
      agua_pct: numOrNull(body.agua_pct),
      cintura_cm: numOrNull(body.cintura_cm),
      sueno_horas: numOrNull(body.sueno_horas),
      source,
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  registrarEvento(sb, { tipo: 'registro_cuerpo', ref_tabla: 'cuerpo_log', ref_id: data.id }).catch(() => null);
  return data;
}

export async function actualizarMedicion(id: string, body: Record<string, any>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of ['peso_kg', 'grasa_pct', 'musculo_kg', 'agua_pct', 'cintura_cm', 'sueno_horas']) {
    if (c in body) patch[c] = numOrNull(body[c]);
  }
  for (const c of ['fecha', 'notas']) if (c in body) patch[c] = body[c]?.trim?.() || null;
  const sb = getSupabaseServer();
  const { data, error } = await sb.from('cuerpo_log').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarMedicion(id: string): Promise<void> {
  const sb = getSupabaseServer();
  const { error } = await sb.from('cuerpo_log').delete().eq('id', id);
  if (error) throw error;
}
