// Tooltip — ayuda corta al hover y al foco de teclado. Reemplaza los title=""
// nativos, que no se ven en movil ni se pueden estilar.
//
// Posicionamiento basico a proposito: absolute + transform relativo al
// disparador, SIN deteccion de colision con el viewport (no hay libreria de
// posicionamiento en el proyecto y no se agrega una por esto). Cerca del borde
// de la pantalla hay que elegir placement a mano.
import type { CSSProperties, ReactNode } from 'react';
import { useId, useState } from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Texto de la ayuda. Corto: una linea o dos. */
  label: string;
  placement?: TooltipPlacement;
  children: ReactNode;
  style?: CSSProperties;
}

const POSICIONES: Record<TooltipPlacement, CSSProperties> = {
  top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
  bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
  left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
  right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
};

export default function Tooltip({ label, placement = 'top', children, style }: TooltipProps) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();

  return (
    <span
      // tabIndex hace que el tooltip tambien se abra con teclado cuando el
      // hijo no es un control enfocable de por si.
      tabIndex={0}
      aria-describedby={abierto ? id : undefined}
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
      onFocus={() => setAbierto(true)}
      onBlur={() => setAbierto(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setAbierto(false); }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}
    >
      {children}
      {abierto && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 300, pointerEvents: 'none',
            width: 'max-content', maxWidth: 220, textAlign: 'center',
            padding: '6px 10px', borderRadius: 'var(--os-r-sm)',
            background: 'var(--os-surface)', border: '1px solid var(--os-line)',
            boxShadow: 'var(--os-shadow-modal)',
            fontFamily: 'var(--os-font-body)', fontSize: 'var(--os-text-xs)',
            color: 'var(--os-text-2)', lineHeight: 1.4, whiteSpace: 'normal',
            ...POSICIONES[placement],
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
