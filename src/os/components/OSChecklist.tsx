import { useState } from 'react';
import type { CheckItem } from '../data/types';

// Checklist estatico (daily.astro): items vienen por props, estado local.
// Distinto de OSChecklistHoy, que trae habitos desde /api/os/habitos.
// Regla de color: hecho/completado = champagne, nunca verde.

interface Props {
  items: CheckItem[];
  title?: string;
}

export default function OSChecklist({ items: initial, title }: Props) {
  const [items, setItems] = useState(initial);

  const toggle = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, completado: !i.completado } : i)));

  const done = items.filter((i) => i.completado).length;

  return (
    <div>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0 }}>
            {title}
          </p>
          <span style={{ fontSize: 'var(--os-text-xs)', color: done === items.length ? 'var(--os-champagne)' : 'var(--os-muted)' }}>
            {done}/{items.length}
          </span>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                width: '100%', border: 'none', cursor: 'pointer',
                padding: '8px 10px', minHeight: 36, borderRadius: '6px', textAlign: 'left',
                background: item.completado ? 'rgba(181,152,90,0.10)' : 'var(--os-fill-subtle)',
                transition: 'background 0.16s',
              }}
            >
              <span style={{
                width: '17px', height: '17px', flexShrink: 0, borderRadius: '4px', marginTop: '1px',
                border: item.completado ? '2px solid var(--os-champagne)' : '2px solid var(--os-line)',
                background: item.completado ? 'var(--os-champagne)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.16s',
              }}>
                {item.completado && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <polyline points="1,3.5 3.5,6 8,1" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span style={{
                fontSize: 'var(--os-text-base)',
                color: item.completado ? 'var(--os-muted)' : 'var(--os-text)',
                textDecoration: item.completado ? 'line-through' : 'none',
                transition: 'color 0.16s',
                lineHeight: 1.45,
              }}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
