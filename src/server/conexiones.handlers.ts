import { getSupabaseServer } from './supabase.ts';

export interface NodoConexion { id: string; etiqueta: string; tipo: 'proyecto' | 'tarea' | 'journal' | 'persona' | 'plan'; meta?: string }
export interface AristaConexion { desde: string; hacia: string; tipo: string }

const clave = (texto: string | null | undefined) => texto?.trim().toLocaleLowerCase() ?? '';

/** Relaciones solo cuando existen campos estructurados compartidos; no infiere personas desde texto libre. */
export async function obtenerConexiones() {
  const sb = getSupabaseServer();
  const [lineas, tareas, journal, personas, planes, objetivos] = await Promise.all([
    sb.from('os_lineas').select('id, nombre, estado').neq('estado', 'pausado'),
    // 'hecho' y 'cancelada' (5 valores desde la Rebanada A) quedan fuera: ninguna
    // de las dos es una tarea activa que valga la pena graficar.
    sb.from('tareas').select('id, titulo, proyecto, estado').not('estado', 'in', '(hecho,cancelada)').limit(80),
    sb.from('os_journal').select('id, titulo, proyecto, fecha').order('fecha', { ascending: false }).limit(60),
    sb.from('os_red_personas').select('id, nombre, area, ultima_interaccion').eq('activo', true).limit(24),
    sb.from('os_red_planes').select('id, meta').eq('activo', true).limit(12),
    sb.from('os_red_objetivos').select('plan_id, persona_id, estado').neq('estado', 'logrado').limit(60),
  ]);
  for (const r of [lineas, tareas, journal, personas, planes, objetivos]) if (r.error) throw r.error;
  const nodos: NodoConexion[] = [];
  const aristas: AristaConexion[] = [];
  const proyectos = new Map<string, string>();
  for (const linea of lineas.data ?? []) {
    const id = `proyecto:${linea.id}`; proyectos.set(clave(linea.nombre), id);
    nodos.push({ id, etiqueta: linea.nombre, tipo: 'proyecto', meta: linea.estado });
  }
  for (const tarea of tareas.data ?? []) {
    const proyectoId = proyectos.get(clave(tarea.proyecto));
    if (!proyectoId) continue;
    const id = `tarea:${tarea.id}`;
    nodos.push({ id, etiqueta: tarea.titulo, tipo: 'tarea', meta: tarea.estado });
    aristas.push({ desde: proyectoId, hacia: id, tipo: 'tarea' });
  }
  for (const entrada of journal.data ?? []) {
    const proyectoId = proyectos.get(clave(entrada.proyecto));
    if (!proyectoId) continue;
    const id = `journal:${entrada.id}`;
    nodos.push({ id, etiqueta: entrada.titulo || 'Entrada de diario', tipo: 'journal', meta: entrada.fecha });
    aristas.push({ desde: proyectoId, hacia: id, tipo: 'journal' });
  }
  const personasIds = new Set<string>();
  for (const persona of personas.data ?? []) {
    const id = `persona:${persona.id}`; personasIds.add(persona.id);
    nodos.push({ id, etiqueta: persona.nombre, tipo: 'persona', meta: persona.area });
  }
  const planesIds = new Set<string>();
  for (const plan of planes.data ?? []) {
    const id = `plan:${plan.id}`; planesIds.add(plan.id);
    nodos.push({ id, etiqueta: plan.meta, tipo: 'plan' });
  }
  for (const objetivo of objetivos.data ?? []) {
    if (planesIds.has(objetivo.plan_id) && personasIds.has(objetivo.persona_id)) aristas.push({ desde: `plan:${objetivo.plan_id}`, hacia: `persona:${objetivo.persona_id}`, tipo: 'red' });
  }
  return { nodos, aristas, meta: { nodos: nodos.length, conexiones: aristas.length } };
}
