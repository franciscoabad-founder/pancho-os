/** Pure, read-only timeblocking suggestions. No calendar provider is required. */
export const FUNCIONES = ['promover', 'vender', 'construir', 'entregar'] as const;
export type Funcion = (typeof FUNCIONES)[number];
export type Modo = 'maker' | 'manager' | 'off';

export interface TimeblockEvent { fecha: string; fin?: string | null; titulo?: string | null; }
export interface TimeblockDay { dia: number; modo: Modo; }
export interface TimeblockBudget { funcion: string; horas_semana_objetivo: number; }
export interface Slot { fecha: string; hora_inicio: string; hora_fin: string; minutos: number; funcion: Funcion; modo: Exclude<Modo, 'off'>; }

const pad = (n: number) => String(n).padStart(2, '0');
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`); const day = d.getUTCDay() || 7;
  return addDays(iso, 1 - day);
}
function minute(value: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null; const h = Number(m[1]); const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}
function localParts(value: string): { date: string; minute: number } | null {
  const date = value.match(/^(\d{4}-\d{2}-\d{2})/); if (!date) return null;
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) {
    const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(parsed);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minute: Number(get('hour')) * 60 + Number(get('minute')) };
  }
  const time = value.match(/T(\d{2}):(\d{2})/); if (time) return { date: date[1], minute: Number(time[1]) * 60 + Number(time[2]) };
  return { date: date[1], minute: 0 };
}
function hhmm(m: number): string { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

/** Returns suggestions only; callers must explicitly persist accepted slots. */
export function sugerirTimeblocks(args: {
  semana: string; dias: TimeblockDay[]; eventos: TimeblockEvent[]; presupuesto: TimeblockBudget[];
  horaInicio?: string; horaFin?: string; minimoMinutos?: number;
}): Slot[] {
  const start = minute(args.horaInicio ?? '08:00') ?? 480;
  const end = minute(args.horaFin ?? '18:00') ?? 1080;
  const min = Math.max(15, Math.min(240, Math.floor(args.minimoMinutos ?? 60)));
  if (end <= start) throw new Error('horaFin debe ser posterior a horaInicio');
  const targets = new Map(FUNCIONES.map((f) => [f, 0]));
  for (const b of args.presupuesto) if (FUNCIONES.includes(b.funcion as Funcion)) targets.set(b.funcion as Funcion, Math.max(0, Number(b.horas_semana_objetivo) || 0) * 60);
  const used = new Map(FUNCIONES.map((f) => [f, 0]));
  const out: Slot[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(args.semana, i); const day = args.dias.find((d) => d.dia === i + 1);
    if (!day || day.modo === 'off') continue;
    const busy = (args.eventos ?? []).map((e) => {
      // Google all-day events arrive as YYYY-MM-DD (end is exclusive). They
      // occupy the whole local day and must not be treated as a zero-minute event.
      if (/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) {
        const finFecha = e.fin && /^\d{4}-\d{2}-\d{2}$/.test(e.fin) ? e.fin : addDays(e.fecha, 1);
        return date >= e.fecha && date < finFecha ? [0, 1440] as [number, number] : null;
      }
      const a = localParts(e.fecha); const b = e.fin ? localParts(e.fin) : null;
      if (!a || a.date !== date) return null;
      return [a.minute, b?.date === date ? b.minute : a.minute + 30] as [number, number];
    }).filter((x): x is [number, number] => Boolean(x)).sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const range of busy) { const last = merged[merged.length - 1]; if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else merged.push(range); }
    let cursor = start;
    for (const [a, b] of [...merged, [end, end] as [number, number]]) {
      const freeEnd = Math.min(end, Math.max(start, a));
      while (freeEnd - cursor >= min) {
        const funcion = FUNCIONES.find((f) => (targets.get(f) ?? 0) > (used.get(f) ?? 0)) ?? null;
        if (!funcion) break;
        const duration = Math.min(60, freeEnd - cursor, (targets.get(funcion)! - used.get(funcion)!));
        if (duration < min) break;
        out.push({ fecha: date, hora_inicio: hhmm(cursor), hora_fin: hhmm(cursor + duration), minutos: duration, funcion, modo: day.modo });
        used.set(funcion, used.get(funcion)! + duration); cursor += duration;
      }
      cursor = Math.max(cursor, b);
    }
  }
  return out;
}
