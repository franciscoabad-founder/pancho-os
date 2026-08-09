// Card — superficie clay estandar. Contrato identico a .os-card / .os-card-2.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 'surface' = card primaria con sombra clay; 'sunken' = card secundaria plana. */
  variant?: 'surface' | 'sunken';
  /** Borde acentuado (equivalente a .os-card-accent). */
  accent?: boolean;
  /** Hover interactivo (equivalente a .os-card-interactive). */
  interactive?: boolean;
  padding?: string | number;
  children: ReactNode;
}

export default function Card({
  variant = 'surface', accent = false, interactive = false, padding = '1.25rem',
  style, children, ...rest
}: CardProps) {
  const base: CSSProperties = variant === 'surface'
    ? { background: 'var(--os-surface)', border: '1px solid var(--os-line)', boxShadow: 'var(--os-shadow-card)' }
    : { background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)' };
  return (
    <div
      className={interactive ? 'os-card-interactive' : undefined}
      style={{
        borderRadius: 'var(--os-r-card)', padding,
        ...base,
        ...(accent ? { borderColor: 'var(--os-line-accent)' } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
