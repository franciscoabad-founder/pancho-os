import type { Dia, MusculoPrimario } from './tipos';

// Mapa muscular v1: siluetas frente/espalda muy simples (rects/ellipses), ~15
// grupos coloreados según si el día entrena ese grupo (musculos_primarios de
// cualquier ejercicio del día). Sin librerías: solo SVG inline.
const PARTES: { id: string; label: string; test: (m: MusculoPrimario) => boolean }[] = [
  { id: 'chest', label: 'Pecho', test: (m) => m.grupo === 'chest' },
  { id: 'shoulders', label: 'Hombros', test: (m) => m.grupo === 'shoulders' },
  { id: 'biceps', label: 'Bíceps', test: (m) => m.grupo === 'biceps' },
  { id: 'triceps', label: 'Tríceps', test: (m) => m.grupo === 'triceps' },
  { id: 'forearms', label: 'Antebrazos', test: (m) => m.grupo === 'forearms' },
  { id: 'abs', label: 'Abdomen', test: (m) => m.grupo === 'abs' },
  { id: 'quads', label: 'Cuádriceps', test: (m) => m.sub === 'quads' },
  { id: 'innerThigh', label: 'Aductores', test: (m) => m.sub === 'inner-thigh' },
  { id: 'outerThigh', label: 'Abductores', test: (m) => m.sub === 'outer-thigh' },
  { id: 'calves', label: 'Pantorrillas', test: (m) => m.grupo === 'lower-leg' },
  { id: 'traps', label: 'Trapecios', test: (m) => m.sub === 'traps' },
  { id: 'lats', label: 'Dorsales', test: (m) => m.sub === 'lats' },
  { id: 'middleBack', label: 'Espalda media', test: (m) => m.sub === 'middle-back' },
  { id: 'lowerBack', label: 'Espalda baja', test: (m) => m.sub === 'lower-back' },
  { id: 'glutes', label: 'Glúteos', test: (m) => m.grupo === 'glutes' },
  { id: 'hamstrings', label: 'Isquiotibiales', test: (m) => m.sub === 'hamstrings' },
];

function gruposActivos(dia: Pick<Dia, 'gfit_dia_ejercicios'>): Set<string> {
  const activos = new Set<string>();
  for (const de of dia.gfit_dia_ejercicios ?? []) {
    const musculos = de.ejercicio?.musculos_primarios ?? [];
    for (const parte of PARTES) {
      if (activos.has(parte.id)) continue;
      if (musculos.some((m) => parte.test(m))) activos.add(parte.id);
    }
  }
  return activos;
}

function fill(activos: Set<string>, id: string): string {
  return activos.has(id) ? 'var(--os-accent)' : 'var(--os-line-soft)';
}

export default function OSGfitBodyMap({ dia }: { dia: Pick<Dia, 'gfit_dia_ejercicios'> }) {
  const activos = gruposActivos(dia);
  if (!activos.size) return null;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center', padding: '6px 0 2px' }}>
      {/* Frente */}
      <svg viewBox="0 0 60 140" width="62" height="140" aria-label="Vista frontal">
        <ellipse cx="30" cy="10" rx="9" ry="10" fill="var(--os-line-soft)" />
        <rect x="26" y="19" width="8" height="7" fill="var(--os-line-soft)" />
        <rect x="8" y="24" width="14" height="11" rx="4" fill={fill(activos, 'shoulders')} />
        <rect x="38" y="24" width="14" height="11" rx="4" fill={fill(activos, 'shoulders')} />
        <rect x="20" y="26" width="20" height="20" rx="3" fill={fill(activos, 'chest')} />
        <rect x="22" y="47" width="16" height="18" rx="3" fill={fill(activos, 'abs')} />
        <rect x="3" y="33" width="9" height="18" rx="4" fill={fill(activos, 'biceps')} />
        <rect x="48" y="33" width="9" height="18" rx="4" fill={fill(activos, 'biceps')} />
        <rect x="2" y="52" width="8" height="18" rx="4" fill={fill(activos, 'forearms')} />
        <rect x="50" y="52" width="8" height="18" rx="4" fill={fill(activos, 'forearms')} />
        <rect x="10" y="68" width="8" height="30" rx="4" fill={fill(activos, 'outerThigh')} />
        <rect x="19" y="68" width="8" height="30" rx="3" fill={fill(activos, 'quads')} />
        <rect x="33" y="68" width="8" height="30" rx="3" fill={fill(activos, 'quads')} />
        <rect x="42" y="68" width="8" height="30" rx="4" fill={fill(activos, 'innerThigh')} />
        <rect x="14" y="100" width="12" height="26" rx="4" fill={fill(activos, 'calves')} />
        <rect x="34" y="100" width="12" height="26" rx="4" fill={fill(activos, 'calves')} />
      </svg>
      {/* Espalda */}
      <svg viewBox="0 0 60 140" width="62" height="140" aria-label="Vista posterior">
        <ellipse cx="30" cy="10" rx="9" ry="10" fill="var(--os-line-soft)" />
        <rect x="26" y="19" width="8" height="7" fill="var(--os-line-soft)" />
        <path d="M20 24 L40 24 L36 34 L24 34 Z" fill={fill(activos, 'traps')} />
        <rect x="8" y="24" width="12" height="11" rx="4" fill={fill(activos, 'shoulders')} />
        <rect x="40" y="24" width="12" height="11" rx="4" fill={fill(activos, 'shoulders')} />
        <rect x="9" y="34" width="12" height="20" rx="3" fill={fill(activos, 'lats')} />
        <rect x="39" y="34" width="12" height="20" rx="3" fill={fill(activos, 'lats')} />
        <rect x="22" y="34" width="16" height="14" rx="3" fill={fill(activos, 'middleBack')} />
        <rect x="22" y="49" width="16" height="14" rx="3" fill={fill(activos, 'lowerBack')} />
        <rect x="3" y="33" width="9" height="18" rx="4" fill={fill(activos, 'triceps')} />
        <rect x="48" y="33" width="9" height="18" rx="4" fill={fill(activos, 'triceps')} />
        <rect x="2" y="52" width="8" height="18" rx="4" fill={fill(activos, 'forearms')} />
        <rect x="50" y="52" width="8" height="18" rx="4" fill={fill(activos, 'forearms')} />
        <rect x="14" y="64" width="32" height="14" rx="5" fill={fill(activos, 'glutes')} />
        <rect x="14" y="79" width="15" height="22" rx="4" fill={fill(activos, 'hamstrings')} />
        <rect x="31" y="79" width="15" height="22" rx="4" fill={fill(activos, 'hamstrings')} />
        <rect x="14" y="102" width="12" height="24" rx="4" fill={fill(activos, 'calves')} />
        <rect x="34" y="102" width="12" height="24" rx="4" fill={fill(activos, 'calves')} />
      </svg>
    </div>
  );
}
