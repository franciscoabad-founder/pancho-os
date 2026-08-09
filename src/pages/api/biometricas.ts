export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg, hoyGuayaquil, numOrNull, isExternalTokenAuthorized } from '../../lib/salud/apiHelpers';

// Contrato completo del flujo n8n (Google Health API) en
// apps/web/docs/contrato-biometricas.md.

const DIAS_DEFAULT = 30;

interface DiaBiometrico {
  fecha?: string;
  pasos?: unknown;
  sueno_min?: unknown;
  peso_kg?: unknown;
  fc_reposo?: unknown;
  fuente?: unknown;
  raw?: unknown;
}

// Entero no negativo o null. Usado para pasos, sueno_min y fc_reposo, que no aceptan
// decimales ni valores negativos (a diferencia de numOrNull genérico).
function intNoNegativoOrNull(v: unknown): number | null | 'invalido' {
  if (v === undefined || v === null || v === '') return null;
  const n = numOrNull(v);
  if (n === null) return 'invalido';
  if (!Number.isInteger(n) || n < 0) return 'invalido';
  return n;
}

// Valida y arma el payload de upsert para un día. Devuelve { error } si algo no cumple el
// contrato, o { payload } listo para insertar/actualizar.
function construirPayload(dia: DiaBiometrico): { error: string } | { payload: Record<string, unknown> } {
  const fecha = typeof dia.fecha === 'string' && dia.fecha.trim() ? dia.fecha.trim() : hoyGuayaquil();

  const pasos = intNoNegativoOrNull(dia.pasos);
  if (pasos === 'invalido') return { error: 'pasos debe ser un entero no negativo' };

  const sueno_min = intNoNegativoOrNull(dia.sueno_min);
  if (sueno_min === 'invalido') return { error: 'sueno_min debe ser un entero no negativo' };

  const fc_reposo = intNoNegativoOrNull(dia.fc_reposo);
  if (fc_reposo === 'invalido') return { error: 'fc_reposo debe ser un entero no negativo' };

  let peso_kg: number | null = null;
  if (dia.peso_kg !== undefined && dia.peso_kg !== null && dia.peso_kg !== '') {
    const n = numOrNull(dia.peso_kg);
    if (n === null || n <= 0) return { error: 'peso_kg debe ser numérico y mayor a 0' };
    peso_kg = n;
  }

  if (pasos === null && sueno_min === null && peso_kg === null && fc_reposo === null) {
    return { error: 'se requiere al menos una metrica' };
  }

  const fuente = typeof dia.fuente === 'string' && dia.fuente.trim() ? dia.fuente.trim() : 'google_health';

  // El upsert MERGEA: solo se escriben las metricas que vinieron de verdad. Incluir
  // las ausentes como null las borraria del dia, y las sincronizaciones de Google
  // Health son parciales por naturaleza (los pasos llegan en la manana, el sueno
  // despues). Un POST de solo pasos no puede tumbar el peso ya registrado.
  const payload: Record<string, unknown> = {
    fecha,
    fuente,
    updated_at: new Date().toISOString(),
  };
  if (pasos !== null) payload.pasos = pasos;
  if (sueno_min !== null) payload.sueno_min = sueno_min;
  if (peso_kg !== null) payload.peso_kg = peso_kg;
  if (fc_reposo !== null) payload.fc_reposo = fc_reposo;
  if (dia.raw !== undefined && dia.raw !== null) payload.raw = dia.raw;

  return { payload };
}

// GET: lista por rango (?desde=&hasta=, default últimos 30 días hasta hoy) o un día
// puntual (?fecha=YYYY-MM-DD).
export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { searchParams } = context.url;
    const fechaUnica = searchParams.get('fecha');

    if (fechaUnica) {
      const { data, error } = await sb
        .from('biometricas_dia')
        .select('*')
        .eq('fecha', fechaUnica)
        .maybeSingle();
      if (error) throw error;
      return json({ biometrica: data ?? null });
    }

    const hasta = searchParams.get('hasta') || hoyGuayaquil();
    let desde = searchParams.get('desde');
    if (!desde) {
      const d = new Date(`${hasta}T00:00:00`);
      d.setDate(d.getDate() - (DIAS_DEFAULT - 1));
      desde = d.toISOString().slice(0, 10);
    }

    const { data, error } = await sb
      .from('biometricas_dia')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return json({ biometricas: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// POST: upsert idempotente por fecha. Acepta un día único o un batch { dias: [...] } para
// que n8n pueda hacer backfill de varios días en una sola llamada.
export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if (Array.isArray(body?.dias)) {
      if (!body.dias.length) return json({ error: 'dias no puede estar vacío' }, 400);
      const payloads: Record<string, unknown>[] = [];
      for (const dia of body.dias) {
        const resultado = construirPayload(dia ?? {});
        if ('error' in resultado) return json({ error: resultado.error }, 400);
        payloads.push(resultado.payload);
      }
      // Upsert de a uno a proposito: cada payload trae SOLO las metricas que vinieron,
      // asi que sus claves difieren entre items. Un upsert masivo obligaria a una lista
      // de columnas unica y rellenaria las faltantes con null, que es justo el borrado
      // que se quiere evitar (ademas de que PostgREST exige claves homogeneas).
      const filas: unknown[] = [];
      for (const payload of payloads) {
        const { data, error } = await sb
          .from('biometricas_dia')
          .upsert(payload, { onConflict: 'fecha' })
          .select()
          .single();
        if (error) throw error;
        filas.push(data);
      }
      return json({ biometricas: filas, n: filas.length });
    }

    const resultado = construirPayload(body ?? {});
    if ('error' in resultado) return json({ error: resultado.error }, 400);

    const { data, error } = await sb
      .from('biometricas_dia')
      .upsert(resultado.payload, { onConflict: 'fecha' })
      .select()
      .single();
    if (error) throw error;
    return json({ biometrica: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
