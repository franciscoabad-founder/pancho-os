import { Link, useRouterState } from '@tanstack/react-router';

const tabs = [
  { to: '/contenido', label: 'Pipeline', icon: 'edit_note' },
  { to: '/os/contenido/planner', label: 'Planner', icon: 'calendar_view_week' },
  { to: '/os/contenido/radar', label: 'Radar', icon: 'radar' },
] as const;

export default function ContenidoNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return <nav aria-label="Secciones de contenido" style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
    {tabs.map((tab) => {
      const activa = pathname === tab.to;
      return <Link key={tab.to} to={tab.to} className={`os-pill${activa ? ' os-pill-accent' : ''}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: '1px solid var(--os-line)', color: activa ? undefined : 'var(--os-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>{tab.label}
      </Link>;
    })}
  </nav>;
}
