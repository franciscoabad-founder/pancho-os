// Button — boton estandar del OS. Variantes: primary (ultramarine), secondary
// (borde), ghost, danger (#D4537E, coral suave del canon, nunca rojo hazard).
// Area tactil: min-height 36px (sm) / 40px (md) y 44px en pointer: coarse via
// la clase .os-btn (definida en os.css).
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANTES: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--os-accent)', color: '#fff', border: '1px solid transparent' },
  secondary: { background: 'transparent', color: 'var(--os-accent-light)', border: '1px solid var(--os-line-accent)' },
  ghost: { background: 'var(--os-fill-subtle)', color: 'var(--os-text-2)', border: '1px solid var(--os-line)' },
  danger: { background: 'transparent', color: '#D4537E', border: '1px solid rgba(212, 83, 126, 0.4)' },
};

const TAMANOS: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 'var(--os-text-xs)', minHeight: 36 },
  md: { padding: '9px 16px', fontSize: 'var(--os-text-sm)', minHeight: 40 },
};

export default function Button({ variant = 'primary', size = 'md', style, disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className="os-btn"
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderRadius: 'var(--os-r-sm)', fontFamily: 'var(--os-font-display)', fontWeight: 700,
        letterSpacing: '0.02em', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        opacity: disabled ? 0.55 : 1, transition: 'background 0.15s, transform 0.12s',
        ...VARIANTES[variant],
        ...TAMANOS[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
