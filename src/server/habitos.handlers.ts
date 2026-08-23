// Logica de /api/habitos, portada de src/pages/api/habitos.ts (Astro).
//
// Los handlers devuelven un Response ya armado (no datos crudos como
// notas.handlers.ts) porque este endpoint tiene muchisimas ramas de validacion
// con status propio (400 por cada campo, 404, 409). Traducirlas a excepciones y
// volver a mapearlas en la route seria reescribir el contrato HTTP a mano, que
// es exactamente el riesgo que esta portacion tiene que evitar: la UI de
// Habitos lee los mensajes de error tal cual.
//
// Response es un estandar web, no una dependencia de framework: este modulo
// sigue siendo puro respecto de TanStack.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { json } from './osAuth.ts';
import { hoyLocal, addDias, diaIso, proximaOcurrencia } from '../lib/habitos/fechas.ts';
import { rachaDiaria, falloAyer } from '../lib/habitos/racha.ts';
import { scoreEma, diasProgramados } from '../lib/habitos/ema.ts';
import { nivelDesdeXp } from '../lib/juego/nivel.ts';
import { cerrarPendientes } from './habitos.cierre.handlers.ts';

const TIPOS = ['habito', 'diaria'];
const DIFICULTADES = ['trivial', 'facil', 'media', 'dificil'];
const ESTADOS = ['activo', 'pausado', 'archivado'];
const SOURCES = ['manual', 'telegram', 'agente'];
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const errMsg = (err: unknown) =>
  err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);

function diasSemanaValidos(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 7 &&
    v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  );
}

// Crea (o reemplaza) el recordatorio de un hábito a partir de su hora_recordatorio.
async function crearRecordatorio(
  sb: SupabaseClient,
  habito: { id: string; nombre: string; intencion: string | null; dias_semana: number[] },
  horaRecordatorio: string,
) {
  const recordarAt = proximaOcurrencia(habito.dias_semana ?? [], horaRecordatorio, new Date());
  const { error } = await sb.from('recordatorios').insert([{
    mensaje: habito.intencion?.trim() || habito.nombre,
    recordar_at: recordarAt.toISOString(),
    canal: 'telegram',
    habito_id: habito.id,
  }]);
  if (error) throw error;
}

// GET: lista hábitos activos con hecho_hoy, racha, ema, últimos 7 días y perfil (xp/nivel).
// Contrato de respuesta:
//   { habitos: [{ ...campos de la tabla habitos, hecho_hoy, conteo_hoy, racha, ema, falloAyer,
//                  ultimos7 }], perfil: { xp_total, nivel } }
// Para 'diaria': hecho_hoy boolean, racha {actual,mejor}, ema number 0..1, falloAyer boolean,
//   ultimos7 boolean[7] (más reciente al final). conteo_hoy es null.
// Para 'habito' (+/-): conteo_hoy {mas,menos}. hecho_hoy, racha, ema, falloAyer, ultimos7 = null.
export async function listarHabitos(request: Request): Promise<Response> {
  try {
    const sb = getSupabaseServer();
    const hoy = hoyLocal();
    const vistaHoy = new URL(request.url).searchParams.get('vista') === 'hoy';

    // Fallback lazy del cierre diario: si n8n no corrió a las 00:05 (o aún no hay
    // ningún cierre), lo procesa aquí antes de listar. Query barata primero (max fecha);
    // si ya está al día, no hace nada. Silencioso: un fallo del cierre no debe romper
    // el listado de hábitos.
    const ayer = addDias(hoy, -1);
    const { data: ultimoCierre } = await sb
      .from('habito_cierres')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultimoCierre || ultimoCierre.fecha < ayer) {
      try {
        await cerrarPendientes(sb);
      } catch {
        // best-effort: se reintentará en la próxima llamada.
      }
    }

    const { data: habitosData, error: errHabitos } = await sb
      .from('habitos')
      .select('*')
      .neq('estado', 'archivado')
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });
    if (errHabitos) throw errHabitos;

    const habitos = habitosData ?? [];
    const ids = habitos.map((h) => h.id);

    // Una sola query de checks (120 días) para todos los hábitos; se agrupa en memoria.
    const desde120 = addDias(hoy, -120);
    const checksPorHabito = new Map<string, { fecha: string; signo: string }[]>();
    if (ids.length) {
      const { data: checksData, error: errChecks } = await sb
        .from('habito_checks')
        .select('habito_id, fecha, signo')
        .in('habito_id', ids)
        .gte('fecha', desde120);
      if (errChecks) throw errChecks;
      for (const c of checksData ?? []) {
        const lista = checksPorHabito.get(c.habito_id) ?? [];
        lista.push({ fecha: c.fecha, signo: c.signo });
        checksPorHabito.set(c.habito_id, lista);
      }
    }

    const desde60 = addDias(hoy, -60);
    const resultado = habitos.map((h) => {
      const checks = checksPorHabito.get(h.id) ?? [];
      const fechasMas = new Set(checks.filter((c) => c.signo === 'mas').map((c) => c.fecha));
      const diasSemana: number[] = h.dias_semana ?? [];

      if (h.tipo === 'diaria') {
        const racha = rachaDiaria(fechasMas, diasSemana, hoy);
        const ema = scoreEma(diasProgramados(desde60, hoy, diasSemana, fechasMas));
        const ultimos7: boolean[] = [];
        for (let i = 6; i >= 0; i--) {
          const fecha = addDias(hoy, -i);
          ultimos7.push(diasSemana.includes(diaIso(fecha)) && fechasMas.has(fecha));
        }
        // El hábito debe haber existido ayer (created_at <= ayer) para que un "no
        // hecho" cuente como fallo: un hábito creado hoy no pudo fallar ayer.
        const existiaAyer = (h.created_at ?? '').slice(0, 10) <= ayer;
        return {
          ...h,
          hecho_hoy: fechasMas.has(hoy),
          conteo_hoy: null,
          racha,
          ema,
          falloAyer: existiaAyer && falloAyer(fechasMas, diasSemana, hoy),
          ultimos7,
        };
      }

      const conteoHoy = checks.reduce(
        (acc, c) => {
          if (c.fecha !== hoy) return acc;
          if (c.signo === 'mas') acc.mas += 1;
          else acc.menos += 1;
          return acc;
        },
        { mas: 0, menos: 0 },
      );
      return {
        ...h,
        hecho_hoy: null,
        conteo_hoy: conteoHoy,
        racha: null,
        ema: null,
        falloAyer: null,
        ultimos7: null,
      };
    });

    const filtrado = vistaHoy
      ? resultado.filter(
          (h) =>
            (h.tipo === 'diaria' && (h.dias_semana ?? []).includes(diaIso(hoy))) ||
            (h.tipo === 'habito' && h.en_checklist === true),
        )
      : resultado;

    // Lee el estado agregado desde `jugador` (motor B); si la tabla aún no existe
    // (B no migrado), cae a `habitos_perfil` (A) para no romper mientras tanto.
    let xpTotal = 0;
    try {
      const { data: jugadorRows, error: errJugador } = await sb.from('jugador').select('xp_total').limit(1);
      if (errJugador) throw errJugador;
      if (jugadorRows && jugadorRows.length > 0) {
        xpTotal = jugadorRows[0].xp_total ?? 0;
      } else {
        throw new Error('sin fila de jugador');
      }
    } catch {
      const { data: perfil, error: errPerfil } = await sb
        .from('habitos_perfil')
        .select('xp_total')
        .limit(1)
        .maybeSingle();
      if (errPerfil) throw errPerfil;
      xpTotal = perfil?.xp_total ?? 0;
    }

    return json({ habitos: filtrado, perfil: { xp_total: xpTotal, nivel: nivelDesdeXp(xpTotal) } });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}

// POST: crea un hábito. Si trae hora_recordatorio, agenda su primer recordatorio.
export async function crearHabito(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    const nombre = body.nombre?.toString().trim();
    if (!nombre) return json({ error: 'nombre requerido' }, 400);
    if (!TIPOS.includes(body.tipo)) return json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` }, 400);

    const dificultad = body.dificultad?.toString().trim() || 'facil';
    if (!DIFICULTADES.includes(dificultad)) {
      return json({ error: `dificultad debe ser una de: ${DIFICULTADES.join(', ')}` }, 400);
    }

    if ('dias_semana' in body && body.dias_semana !== undefined && !diasSemanaValidos(body.dias_semana)) {
      return json({ error: 'dias_semana debe ser un arreglo de 1 a 7 valores ISO (1=lunes..7=domingo)' }, 400);
    }

    if (body.hora_recordatorio && !HORA_RE.test(body.hora_recordatorio)) {
      return json({ error: 'hora_recordatorio debe tener formato HH:MM' }, 400);
    }

    const source = body.source?.toString().trim() || 'manual';
    if (!SOURCES.includes(source)) return json({ error: `source debe ser uno de: ${SOURCES.join(', ')}` }, 400);

    const insert: Record<string, unknown> = {
      nombre,
      descripcion: body.descripcion?.toString().trim() || null,
      tipo: body.tipo,
      dificultad,
      intencion: body.intencion?.toString().trim() || null,
      hora_recordatorio: body.hora_recordatorio || null,
      journey_id: body.journey_id || null,
      source,
    };
    if (typeof body.permite_mas === 'boolean') insert.permite_mas = body.permite_mas;
    if (typeof body.permite_menos === 'boolean') insert.permite_menos = body.permite_menos;
    if (typeof body.es_core === 'boolean') insert.es_core = body.es_core;
    if (typeof body.en_checklist === 'boolean') insert.en_checklist = body.en_checklist;
    if (Number.isInteger(body.orden)) insert.orden = body.orden;
    if (diasSemanaValidos(body.dias_semana)) insert.dias_semana = body.dias_semana;

    const sb = getSupabaseServer();
    const { data, error } = await sb.from('habitos').insert([insert]).select().single();
    if (error) throw error;

    if (body.hora_recordatorio) {
      await crearRecordatorio(sb, data, body.hora_recordatorio);
    }

    return json({ ok: true, habito: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}

// PATCH ?id=: edita campos del hábito. Si cambia hora_recordatorio, reemplaza sus
// recordatorios pendientes (los borra y crea el nuevo, o solo los borra si viene null).
export async function actualizarHabito(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if ('nombre' in body) {
      const nombre = body.nombre?.toString().trim();
      if (!nombre) return json({ error: 'nombre requerido' }, 400);
      patch.nombre = nombre;
    }
    if ('descripcion' in body) patch.descripcion = body.descripcion?.toString().trim() || null;
    if ('dificultad' in body) {
      const dificultad = body.dificultad?.toString().trim();
      if (!DIFICULTADES.includes(dificultad)) {
        return json({ error: `dificultad debe ser una de: ${DIFICULTADES.join(', ')}` }, 400);
      }
      patch.dificultad = dificultad;
    }
    if ('dias_semana' in body) {
      if (!diasSemanaValidos(body.dias_semana)) {
        return json({ error: 'dias_semana debe ser un arreglo de 1 a 7 valores ISO (1=lunes..7=domingo)' }, 400);
      }
      patch.dias_semana = body.dias_semana;
    }
    if ('tipo' in body) {
      const tipo = body.tipo?.toString();
      if (!TIPOS.includes(tipo)) return json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` }, 400);
      patch.tipo = tipo;
    }
    if ('permite_mas' in body) {
      if (typeof body.permite_mas !== 'boolean') return json({ error: 'permite_mas debe ser booleano' }, 400);
      patch.permite_mas = body.permite_mas;
    }
    if ('permite_menos' in body) {
      if (typeof body.permite_menos !== 'boolean') return json({ error: 'permite_menos debe ser booleano' }, 400);
      patch.permite_menos = body.permite_menos;
    }
    if ('intencion' in body) patch.intencion = body.intencion?.toString().trim() || null;
    if ('hora_recordatorio' in body) {
      if (body.hora_recordatorio && !HORA_RE.test(body.hora_recordatorio)) {
        return json({ error: 'hora_recordatorio debe tener formato HH:MM' }, 400);
      }
      patch.hora_recordatorio = body.hora_recordatorio || null;
    }
    if ('es_core' in body) {
      if (typeof body.es_core !== 'boolean') return json({ error: 'es_core debe ser booleano' }, 400);
      patch.es_core = body.es_core;
    }
    if ('en_checklist' in body) {
      if (typeof body.en_checklist !== 'boolean') return json({ error: 'en_checklist debe ser booleano' }, 400);
      patch.en_checklist = body.en_checklist;
    }
    if ('orden' in body) {
      if (!Number.isInteger(body.orden)) return json({ error: 'orden debe ser un entero' }, 400);
      patch.orden = body.orden;
    }
    if ('estado' in body) {
      const estado = body.estado?.toString();
      if (!ESTADOS.includes(estado)) return json({ error: `estado debe ser uno de: ${ESTADOS.join(', ')}` }, 400);
      patch.estado = estado;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);
    patch.updated_at = new Date().toISOString();

    const sb = getSupabaseServer();
    const { data, error } = await sb.from('habitos').update(patch).eq('id', id).select().single();
    if (error) throw error;

    if ('hora_recordatorio' in body) {
      const { error: errDelete } = await sb
        .from('recordatorios')
        .delete()
        .eq('habito_id', id)
        .eq('estado', 'pendiente');
      if (errDelete) throw errDelete;
      if (body.hora_recordatorio) {
        await crearRecordatorio(sb, data, body.hora_recordatorio);
      }
    }

    return json({ ok: true, habito: data });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}

// DELETE ?id=: no borra (el ledger de checks lo referencia); archiva.
export async function archivarHabito(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb
      .from('habitos')
      .update({ estado: 'archivado', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
}
