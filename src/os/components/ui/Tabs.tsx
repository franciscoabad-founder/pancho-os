// Tabs — tabs horizontales, scrollables en movil (patron .os-hscroll).
// Controlado: el padre guarda el tab activo.
import type { CSSProperties } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Contador opcional a la derecha del label. */
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  style?: CSSProperties;
}

export default function Tabs({ tabs, active, onChange, style }: TabsProps) {
  return (
    <div
      role="tablist"
      className="os-hscroll"
      style={{ display: 'flex', gap: 6, paddingBottom: 2, ...style }}
    >
      {tabs.map((t) => {
        const activo = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 14px', minHeight: 36, borderRadius: 'var(--os-r-full)',
              fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 700,
              letterSpacing: '0.01em', whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
              transition: 'background 0.15s, color 0.15s', flexShrink: 0,
              background: activo ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
              color: activo ? '#fff' : 'var(--os-text-2)',
              boxShadow: activo ? 'var(--os-shadow-accent)' : 'none',
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 11, opacity: 0.85 }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
