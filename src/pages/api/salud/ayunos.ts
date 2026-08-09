export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg, numOrNull, isExternalTokenAuthorized } from '../../../lib/salud/apiHelpers';
import { registrarEvento } from '../../../lib/juego/motor';
import { duracionHoras } from '../../../lib/salud/ayuno';

type SB = ReturnType<typeof getSupabaseServer>;

// Valores admitidos por la columna ayunos.protocolo (check constraint en la migraciÃ³n
// 20260715000000). Los presets nuevos del UI (Fase 5) NO amplÃ­an ese enum: se mapean.
const PROTOCOLOS = ['16_8', '18_6', '20_4', 'omad', 'extendido', 'custom'];
// Horas objetivo por defecto segÃºn protocolo (legacy + presets Fase 5).
const OBJETIVO_POR_PROTOCOLO: Record<string, number> = {
  '16_8': 16, '18_6': 18, '20_4': 20, omad: 23, extendido: 36,
  '24h': 24, '36h': 36,
};
// Presets Fase 5 -> valor vÃ¡lido para la columna ayunos.protocolo. '24h' no tiene token
// legacy exacto (omad es 23h) asÃ­ que cae a 'custom'; '36h' coincide con 'extendido'.
// Las horas reales viajan siempre en objetivo_horas, no dependen de este mapeo.
const PRESET_A_LEGACY: Record<string, string> = { '24h': 'custom', '36h': 'extendido' };

// Horas por defecto tras las que, sin ayuno abierto, se sugiere "Â¿sigues comiendo o ya
// estÃ¡s ayunando?" en el GET (informativo, el recordatorio del cierre diario vive en
// juego/cierre.ts). No confundir con el objetivo del protocolo: esto es solo el umbral
// de la sugerencia manual-first.
const HORAS_SIN_REGISTRO = 24;

// Protocolo + objetivo por defecto (Fase 5). El protocolo vive en la columna existente
// salud_config.protocolo_ayuno_default; las horas custom en salud_config.ayuno_objetivo_h
// (Ãºnica columna nueva, ver 20260720000100). El PATCH que los actualiza vive en
// /api/salud/config.ts, no acÃ¡.
async function getAyunoConfig(sb: SB): Promise<{ protocolo: string; objetivo_h: number }> {
  const { data, error } = await sb
    .from('salud_config')
    .select('protocolo_ayuno_default, ayuno_objetivo_h')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const protocolo = data?.protocolo_ayuno_default ?? '16_8';
  return {
    protocolo,
    // Presets con horas fijas las derivan del mapa; custom (o token desconocido) usa
    // las horas guardadas en ayuno_objetivo_h.
    objetivo_h: OBJETIVO_POR_PROTOCOLO[protocolo] ?? numOrNull(data?.ayuno_objetivo_h) ?? 16,
  };
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const config = await getAyunoConfig(sb);

    // Ayuno abierto (sin fin). Usado por NutriciÃ³n para ofrecer cierre y por el timer.
    if (url.searchParams.get('abierto') === '1') {
      const { data, error } = await sb
        .from('ayunos')
        .select('*')
        .is('fin', null)
        .order('inicio', { ascending: false })
        .limit(1);
      if (error) throw error;
      const ayuno = data?.[0] ?? null;

      const respuesta: Record<string, unknown> = { ayuno, ...config };

      if (ayuno) {
        // Informativo. NUNCA se usa para auto-cerrar el ayuno. El objetivo del ayuno
        // abierto es su snapshot objetivo_horas (columna existente).
        const objetivoRef = numOrNull(ayuno.objetivo_horas) ?? config.objetivo_h;
        respuesta.horas_transcurridas = duracionHoras(ayuno.inicio, null);
        respuesta.fin_previsto = new Date(
          new Date(ayuno.inicio).getTime() + objetivoRef * 3_600_000,
        ).toISOString();
      } else {
        // Sugerencia manual-first: sin ayuno abierto y el Ãºltimo cerrado terminÃ³ hace
        // mÃ¡s de HORAS_SIN_REGISTRO. Nunca abre ni cierra nada, solo informa al UI.
        const { data: ultimoCerrado, error: errUltimo } = await sb
          .from('ayunos')
          .select('fin')
          .not('fin', 'is', null)
          .order('fin', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (errUltimo) throw errUltimo;
        if (ultimoCerrado?.fin) {
          const horasDesdeCierre = (Date.now() - new Date(ultimoCerrado.fin).getTime()) / 3_600_000;
          if (horasDesdeCierre > HORAS_SIN_REGISTRO) respuesta.sugerencia = 'sin_registro';
        }
      }

      return json(respuesta);
    }

    // Historial completo.
    const { data, error } = await sb
      .from('ayunos')
      .select('*')
      .order('inicio', { ascending: false });
    if (error) throw error;
    return json({ ayunos: data ?? [], ...config });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  // Escritura externa (agente/telegram) permitida vÃ­a X-OS-Token.
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();
    const config = await getAyunoConfig(sb);

    // Protocolo: body override > default de salud_config. Acepta tokens legacy
    // ('16_8'...'custom') y presets Fase 5 ('24h', '36h'), que se mapean al enum de la
    // columna via PRESET_A_LEGACY.
    const protocoloEntrada = body.protocolo?.trim() || config.protocolo;
    const protocolo = PRESET_A_LEGACY[protocoloEntrada] ?? protocoloEntrada;
    if (!PROTOCOLOS.includes(protocolo)) {
      return json({ error: `protocolo debe ser uno de: ${PROTOCOLOS.join(', ')}, 24h, 36h` }, 400);
    }

    // Snapshot del objetivo en ayunos.objetivo_horas (columna existente): body override
    // (objetivo_horas u objetivo_h, aliases) > horas del protocolo pedido en el body >
    // default de salud_config. Puramente informativo: NUNCA auto-cierra el ayuno.
    const objetivo =
      numOrNull(body.objetivo_horas) ?? numOrNull(body.objetivo_h) ??
      (body.protocolo ? OBJETIVO_POR_PROTOCOLO[protocoloEntrada] : undefined) ??
      config.objetivo_h;

    // Cierra cualquier ayuno abierto antes de iniciar uno nuevo (no solapar). Esto es
    // consecuencia directa de la acciÃ³n manual del usuario al iniciar uno nuevo (existe
    // ademÃ¡s el Ã­ndice Ãºnico ayunos_un_solo_abierto); no es un auto-cierre por tiempo.
    await sb.from('ayunos').update({ fin: new Date().toISOString() }).is('fin', null);

    const { data, error } = await sb
      .from('ayunos')
      .insert([{
        inicio: body.inicio?.trim() || new Date().toISOString(),
        fin: body.fin?.trim() || null,
        protocolo,
        objetivo_horas: objetivo,
        notas: body.notas?.trim() || null,
        source: body.source?.trim() || 'manual',
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ayuno: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context) && !isExternalTokenAuthorized(context)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('inicio' in body) patch.inicio = body.inicio || null;
    if ('fin' in body) patch.fin = body.fin || null;
    if ('notas' in body) patch.notas = body.notas?.trim() || null;
    if ('objetivo_horas' in body) patch.objetivo_horas = numOrNull(body.objetivo_horas);
    if ('protocolo' in body) {
      if (!PROTOCOLOS.includes(body.protocolo)) return json({ error: 'protocolo invÃ¡lido' }, 400);
      patch.protocolo = body.protocolo;
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb.from('ayunos').update(patch).eq('id', id).select().single();
    if (error) throw error;
    if ('fin' in patch && patch.fin) {
      registrarEvento(sb, { tipo: 'ayuno_fin', ref_tabla: 'ayunos', ref_id: id }).catch(() => null);
    }
    return json({ ayuno: data });
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
    const { error } = await sb.from('ayunos').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
