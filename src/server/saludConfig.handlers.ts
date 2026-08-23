// Logica de /api/salud/config, portada de src/pages/api/salud/config.ts.
// Fila unica de salud_config: targets de nutricion y protocolo de ayuno default.

import { getSupabaseServer } from './supabase.ts';
import { error400 } from './saludHttp.ts';

// Presets de protocolo de ayuno (Fase 5, estilo Yazio) para la acción {protocolo} del
// PATCH. Se persisten en la columna EXISTENTE protocolo_ayuno_default (sin check
// constraint en DB; los tokens legacy '18_6'/'20_4'/'omad'/'extendido' siguen siendo
// escribibles vía el passthrough de campos). '16_8' mantiene el formato legacy; '24h' y
// '36h' son tokens nuevos solo de config (al iniciar un ayuno, saludAyunos.handlers.ts
// los mapea al enum de ayunos.protocolo). 'custom' exige objetivo_h explícito, que se
// guarda en ayuno_objetivo_h (única columna nueva, ver 20260720000100).
const PROTOCOLOS_AYUNO = ['16_8', '24h', '36h', 'custom'];
const PROTOCOLO_HORAS: Record<string, number> = { '16_8': 16, '24h': 24, '36h': 36 };

// Devuelve (y crea si no existe) la fila única de salud_config con los targets.
export async function getConfig() {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('salud_config')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (data && data.length) return data[0];
  const { data: created, error: insErr } = await sb
    .from('salud_config')
    .insert([{}])
    .select()
    .single();
  if (insErr) throw insErr;
  return created;
}

export async function actualizarConfig(body: Record<string, any>) {
  const current = await getConfig();
  const sb = getSupabaseServer();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const campos = [
    'kcal_min', 'kcal_max', 'proteina_g', 'carbos_g', 'grasa_g_min', 'grasa_g_max',
    'ajustes_tipo_dia', 'protocolo_ayuno_default', 'unidad_peso', 'preferencias',
    // Targets de Nutricion (paridad Yazio, ver 20260720000000_nutricion_yazio.sql).
    'kcal_objetivo', 'proteina_objetivo_g', 'carbos_objetivo_g', 'grasa_objetivo_g',
  ];
  for (const c of campos) if (c in body) patch[c] = body[c];

  // Protocolo de ayuno (Fase 5): 'protocolo' actualiza protocolo_ayuno_default y
  // sincroniza las horas en ayuno_objetivo_h. 'custom' exige objetivo_h explícito (no
  // hay default razonable). Este PATCH vive acá (y no en ayunos) porque el
  // protocolo/objetivo default son config global.
  if ('protocolo' in body) {
    const protocolo = typeof body.protocolo === 'string' ? body.protocolo.trim() : '';
    if (!PROTOCOLOS_AYUNO.includes(protocolo)) {
      throw error400(`protocolo debe ser uno de: ${PROTOCOLOS_AYUNO.join(', ')}`);
    }
    patch.protocolo_ayuno_default = protocolo;
    if (protocolo === 'custom') {
      const objetivo = typeof body.objetivo_h === 'number' ? body.objetivo_h : Number(body.objetivo_h);
      if (!Number.isFinite(objetivo) || objetivo <= 0) {
        throw error400('protocolo custom requiere objetivo_h numérico');
      }
      patch.ayuno_objetivo_h = objetivo;
    } else {
      patch.ayuno_objetivo_h = PROTOCOLO_HORAS[protocolo];
    }
  } else if ('objetivo_h' in body) {
    // Ajuste directo del objetivo sin cambiar protocolo (ej. afinar un custom existente).
    const objetivo = typeof body.objetivo_h === 'number' ? body.objetivo_h : Number(body.objetivo_h);
    if (!Number.isFinite(objetivo) || objetivo <= 0) throw error400('objetivo_h inválido');
    patch.ayuno_objetivo_h = objetivo;
  }

  const { data, error } = await sb
    .from('salud_config')
    .update(patch)
    .eq('id', current.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
