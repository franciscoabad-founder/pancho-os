// Navegación horizontal entre submódulos de Salud. Mobile-first (scroll horizontal).
//
// Portado de OSSaludNav.astro: mismos items, mismo orden, mismo CSS. El <style>
// del .astro estaba scopeado por el compilador de Astro; aca se emite como
// <style> plano con las mismas dos clases (.salud-nav-pill y su .active), que
// no chocan con nada mas del OS. Se monta una vez por pagina, asi que la regla
// se declara una sola vez por render.

export type SaludNavActivo =
  | 'dashboard' | 'nutricion' | 'ayuno' | 'entrenamiento'
  | 'progreso' | 'cuerpo' | 'sueno' | 'estiramiento';

export interface OSSaludNavProps {
  activo: SaludNavActivo;
}

const items = [
  { key: 'dashboard',     href: '/salud',              label: 'Resumen',      icon: 'favorite' },
  { key: 'nutricion',     href: '/salud/nutricion',    label: 'Nutrición',    icon: 'nutrition' },
  { key: 'ayuno',         href: '/salud/ayuno',        label: 'Ayuno',        icon: 'timer' },
  { key: 'entrenamiento', href: '/gfit',               label: 'Entreno',      icon: 'fitness_center' },
  { key: 'progreso',      href: '/gfit?tab=progreso',  label: 'Progreso',     icon: 'trending_up' },
  { key: 'cuerpo',        href: '/salud/cuerpo',       label: 'Cuerpo',       icon: 'monitor_weight' },
  { key: 'sueno',         href: '/salud/sueno',        label: 'Sueño',        icon: 'bedtime' },
  { key: 'estiramiento',  href: '/salud/estiramiento', label: 'Estiramiento', icon: 'self_improvement' },
];

export default function OSSaludNav({ activo }: OSSaludNavProps) {
  return (
    <>
      <nav
        className="os-hscroll"
        style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', paddingBottom: 4 }}
      >
        {items.map((it) => (
          <a
            key={it.key}
            href={it.href}
            className={`salud-nav-pill${activo === it.key ? ' active' : ''}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{it.icon}</span>
            <span>{it.label}</span>
          </a>
        ))}
      </nav>
      <style>{`
        .salud-nav-pill {
          display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
          padding: 7px 13px; border-radius: 999px; text-decoration: none;
          font-family: var(--os-font-display); font-size: 12px; font-weight: 600;
          color: var(--os-muted); background: rgba(232,234,240,0.04);
          border: 1px solid var(--os-line-soft); transition: color .14s, background .14s, border-color .14s;
          flex-shrink: 0;
        }
        .salud-nav-pill:hover { color: var(--os-text); background: rgba(232,234,240,0.07); }
        .salud-nav-pill.active {
          color: #fff; background: var(--os-accent); border-color: var(--os-accent);
        }
      `}</style>
    </>
  );
}
