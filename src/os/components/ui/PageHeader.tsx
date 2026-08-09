// PageHeader — encabezado estandar de pagina del OS.
// Reemplaza los headers duplicados (eyebrow + h1 + subtitulo + acciones).
// Solo tokens --os-*; clases .os-eyebrow y .os-h1 conservan su contrato.
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Acciones a la derecha (botones, pills). */
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: '1.25rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p className="os-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</p>
        <h1 className="os-h1">{title}</h1>
        {subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
