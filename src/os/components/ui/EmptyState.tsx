// EmptyState — estado vacio estandar: icono opcional + titulo + texto + accion.
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Nombre de Material Symbol (ej. 'inbox') o nodo propio. */
  icon?: string | ReactNode;
  title: string;
  text?: string;
  /** Accion opcional (tipicamente un <Button>). */
  action?: ReactNode;
}

export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '2.5rem 1.25rem', textAlign: 'center',
      }}
    >
      {typeof icon === 'string' ? (
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: 34, color: 'var(--os-muted)', opacity: 0.7 }}
        >
          {icon}
        </span>
      ) : icon}
      <p style={{ margin: 0, fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 'var(--os-text-base)', color: 'var(--os-text)' }}>
        {title}
      </p>
      {text && (
        <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', maxWidth: 420, lineHeight: 1.55 }}>
          {text}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
