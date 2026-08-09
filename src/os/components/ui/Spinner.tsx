// Spinner — indicador de carga. Modo bloque (centrado) o inline ("Cargando...").
import type { CSSProperties } from 'react';

export interface SpinnerProps {
  /** true = texto inline discreto en vez de bloque centrado. */
  inline?: boolean;
  label?: string;
  size?: number;
}

const giro: CSSProperties = {
  borderRadius: '50%',
  border: '2px solid var(--os-line)',
  borderTopColor: 'var(--os-accent)',
  animation: 'os-spin 0.8s linear infinite',
  flexShrink: 0,
};

export default function Spinner({ inline = false, label = 'Cargando...', size = 18 }: SpinnerProps) {
  const keyframes = <style>{'@keyframes os-spin { to { transform: rotate(360deg); } }'}</style>;
  if (inline) {
    return (
      <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>
        {keyframes}
        <span style={{ ...giro, width: 14, height: 14 }} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '2.5rem 1rem' }}>
      {keyframes}
      <span style={{ ...giro, width: size, height: size }} aria-hidden="true" />
      <span style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>{label}</span>
    </div>
  );
}
