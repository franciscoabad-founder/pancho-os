// Badge — pill de estado. Consolida los .os-pill / .os-pill-accent /
// .os-pill-gold / .os-tag sueltos y les da tono semantico con los tokens ya
// existentes (--os-ok, --os-warn, --os-error). Sin colores nuevos, CERO verde:
// hecho/positivo es champagne (--os-ok).
import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'metric' | 'ok' | 'warn' | 'error';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Nombre de Material Symbol (ej. 'check') o nodo propio. */
  icon?: string | ReactNode;
  /** Punto de estado a la izquierda, del mismo color que el tono. */
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

// El fondo se deriva del mismo token con color-mix para no fijar rgba a mano
// y seguir funcionando al cambiar de tema (los tokens cambian de valor).
const TONOS: Record<BadgeTone, string> = {
  neutral: 'var(--os-muted)',
  accent: 'var(--os-accent-light)',
  metric: 'var(--os-champagne)',
  ok: 'var(--os-ok)',
  warn: 'var(--os-warn)',
  error: 'var(--os-error)',
};

export default function Badge({ tone = 'neutral', icon, dot = false, children, style }: BadgeProps) {
  const color = TONOS[tone];
  return (
    <span
      className="os-pill"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: 'var(--os-r-full)', background: color, flexShrink: 0 }}
        />
      )}
      {typeof icon === 'string' ? (
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>
          {icon}
        </span>
      ) : icon}
      {children}
    </span>
  );
}
