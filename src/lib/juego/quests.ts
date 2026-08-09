// Quests semanales (commitment devices, Ariely): apuestan oro, pagan si se cumplen.
// Logica pura, testeable con node:test.

export type ObjetivoQuest =
  | { tipo: 'conteo_eventos' | 'evento'; evento: string; meta: number }
  | { tipo: 'habito'; habito_id: string; meta: number };

export interface Quest {
  apuesta_oro: number;
  premio_xp: number;
  premio_oro: number;
}

export interface EventoSemana {
  tipo: string;
  fecha: string;
}

export interface CheckSemana {
  habito_id: string;
  fecha: string;
}

export type EstadoQuest = 'cumplida' | 'pendiente';

export interface ResultadoEvaluacion {
  estado: EstadoQuest;
  progreso: number;
  meta: number;
}

/**
 * Evalua el progreso de una quest contra los eventos/checks de la semana en curso.
 * 'conteo_eventos' cuenta eventos de un tipo dado; 'habito' cuenta checks de un
 * habito especifico. Cumplida cuando progreso >= meta.
 */
export function evaluarQuest(
  objetivo: ObjetivoQuest,
  eventosSemana: EventoSemana[],
  checksSemana: CheckSemana[],
): ResultadoEvaluacion {
  let progreso = 0;

  // 'evento' es alias de 'conteo_eventos': el front (OSJuego.tsx) y datos ya guardados
  // en Supabase antes de la normalizacion del endpoint usan 'evento'. Se acepta aqui
  // por robustez aunque el POST del endpoint ya normaliza al guardar.
  if (objetivo.tipo === 'conteo_eventos' || objetivo.tipo === 'evento') {
    progreso = eventosSemana.filter((e) => e.tipo === objetivo.evento).length;
  } else if (objetivo.tipo === 'habito') {
    progreso = checksSemana.filter((c) => c.habito_id === objetivo.habito_id).length;
  }

  const meta = objetivo.meta;
  const estado: EstadoQuest = progreso >= meta ? 'cumplida' : 'pendiente';
  return { estado, progreso, meta };
}

export interface LiquidacionQuest {
  xpDelta: number;
  oroDelta: number;
}

/**
 * Liquida una quest al cierre de semana. Ganada: paga premio_xp + premio_oro y
 * devuelve la apuesta_oro (ya estaba bloqueada, no descontada de nuevo). Perdida:
 * {0,0} porque la apuesta ya se desconto al crear la quest (no hay nada mas que restar).
 */
export function liquidarQuest(quest: Quest, cumplida: boolean): LiquidacionQuest {
  if (!cumplida) return { xpDelta: 0, oroDelta: 0 };
  return {
    xpDelta: quest.premio_xp,
    oroDelta: quest.premio_oro + quest.apuesta_oro,
  };
}
