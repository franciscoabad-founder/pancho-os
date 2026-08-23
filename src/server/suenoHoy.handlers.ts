// Logica de /api/salud/sueno/hoy, portada de src/pages/api/salud/sueno/hoy.ts.
//
// Estado de sueno de hoy: deuda, curva de alerta, ventanas y plan.
//
// Consulta las tablas y delega TODO el calculo a lib/sueno/estado.ts, que es
// puro y esta cubierto por tests. Aqui no vive ninguna regla del modelo.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from '../lib/salud/apiHelpers.ts';
import { restarDias } from '../lib/sueno/deuda.ts';
import {
  construirEstado,
  type ConfigSueno,
  type FilaBiometrica,
  type FilaDosis,
  type FilaSesion,
} from '../lib/sueno/estado.ts';

const DIAS_HISTORIAL = 60;

async function leerConfig(sb: SupabaseClient): Promise<ConfigSueno> {
  const { data, error } = await sb.from('sueno_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return data as ConfigSueno;
  const { data: creada, error: errCrear } = await sb
    .from('sueno_config')
    .upsert({ id: 1 }, { onConflict: 'id' })
    .select()
    .single();
  if (errCrear) throw errCrear;
  return creada as ConfigSueno;
}

export async function estadoSuenoHoy(fechaParam: string | null) {
  const sb = getSupabaseServer();
  const hoy = fechaParam || hoyGuayaquil();
  const desdeHistorial = restarDias(hoy, DIAS_HISTORIAL - 1);

  const [config, resSesiones, resBio, resCafe] = await Promise.all([
    leerConfig(sb),
    sb.from('sueno_sesiones').select('*').gte('fecha', desdeHistorial).lte('fecha', hoy).order('inicio'),
    sb.from('biometricas_dia').select('fecha, sueno_min').gte('fecha', desdeHistorial).lte('fecha', hoy),
    sb.from('cafeina_log').select('*').gte('fecha', restarDias(hoy, 1)).lte('fecha', hoy).order('tomado_at'),
  ]);
  if (resSesiones.error) throw resSesiones.error;
  if (resBio.error) throw resBio.error;
  if (resCafe.error) throw resCafe.error;

  return construirEstado({
    hoy,
    ahoraMs: Date.now(),
    config,
    sesiones: (resSesiones.data ?? []) as FilaSesion[],
    biometricas: (resBio.data ?? []) as FilaBiometrica[],
    dosis: (resCafe.data ?? []) as FilaDosis[],
  });
}
