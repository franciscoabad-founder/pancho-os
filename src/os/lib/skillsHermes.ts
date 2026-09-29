// Skills de Hermes vistas desde el OS (Fase 4, 29-sep-2026).
// Puro (sin red): normaliza las filas de GET /api/skills y filtra para la
// pantalla de Capabilities. Lo usan src/server/hermesSkills.handlers.ts y la
// pagina src/routes/hermes_/capabilities.tsx.

export interface SkillHermes {
  nombre: string;
  descripcion: string;
  categoria: string;
  activa: boolean;
  /** De donde viene: integrada, instalada, propia... (texto de Hermes). */
  origen: string;
}

export interface SkillHermesCruda {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  enabled?: unknown;
  provenance?: unknown;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Sin nombre no hay forma de activarla: se descarta. */
export function normalizarSkill(c: SkillHermesCruda): SkillHermes | null {
  const nombre = texto(c.name);
  if (!nombre) return null;
  return {
    nombre,
    descripcion: texto(c.description),
    categoria: texto(c.category) || 'sin categoria',
    activa: c.enabled === true,
    origen: texto(c.provenance) || 'desconocido',
  };
}

/** Nombres validos de skill: letras, numeros, guion, punto, guion bajo y barra (categoria/nombre). */
export const NOMBRE_SKILL = /^[A-Za-z0-9][A-Za-z0-9_./-]{0,120}$/;

export interface FiltroSkills {
  texto?: string | null;
  categoria?: string | null;
  estado?: 'todas' | 'activas' | 'inactivas';
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarSkills(skills: SkillHermes[], f: FiltroSkills): SkillHermes[] {
  const q = sinAcentos(f.texto ?? '').trim();
  return skills.filter((s) => {
    if (f.categoria && s.categoria !== f.categoria) return false;
    if (f.estado === 'activas' && !s.activa) return false;
    if (f.estado === 'inactivas' && s.activa) return false;
    return !q || sinAcentos(`${s.nombre} ${s.descripcion} ${s.categoria}`).includes(q);
  });
}

export interface ResumenSkills {
  total: number;
  activas: number;
  categorias: { categoria: string; total: number }[];
}

export function resumirSkills(skills: SkillHermes[]): ResumenSkills {
  const porCategoria = new Map<string, number>();
  for (const s of skills) porCategoria.set(s.categoria, (porCategoria.get(s.categoria) ?? 0) + 1);
  return {
    total: skills.length,
    activas: skills.filter((s) => s.activa).length,
    categorias: [...porCategoria.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, 'es')),
  };
}
