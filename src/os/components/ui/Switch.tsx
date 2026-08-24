// Switch — toggle on/off. Reemplaza el <Switch> local de OSJuego.tsx (clases
// .m-switch del modulo conductual, que solo existen bajo
// [data-modulo="habitos"]) por un primitivo con tokens --os-* usable en
// cualquier pantalla del OS.
// Area tactil: el boton mide var(--os-tap-min) aunque el riel visible sea de
// 28px, para no perder el objetivo tactil.
import type { CSSProperties, ReactNode } from 'react';

const RIEL_W = 52;
const RIEL_H = 28;
const KNOB = 22;

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto a la izquierda del riel. Sin label, usar ariaLabel. */
  label?: ReactNode;
  /** Nota corta bajo el label. */
  hint?: string;
  /** Etiqueta accesible cuando no hay label visible. */
  ariaLabel?: string;
  disabled?: boolean;
  /** El boton ocupa todo el ancho y separa label y riel a los extremos. */
  block?: boolean;
  style?: CSSProperties;
}

export default function Switch({
  checked, onChange, label, hint, ariaLabel, disabled = false, block = false, style,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: block ? 'flex' : 'inline-flex', alignItems: 'center', gap: 12,
        justifyContent: block ? 'space-between' : 'flex-start',
        width: block ? '100%' : undefined,
        minHeight: 'var(--os-tap-min)', padding: 0,
        background: 'transparent', border: 'none', textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {label && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-sm)',
              fontWeight: 600, color: 'var(--os-text)',
            }}
          >
            {label}
          </span>
          {hint && (
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', lineHeight: 1.4 }}>
              {hint}
            </span>
          )}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          position: 'relative', flexShrink: 0,
          width: RIEL_W, height: RIEL_H, borderRadius: 'var(--os-r-full)',
          // Apagado se deriva de --os-muted para que siga legible en ambos temas.
          background: checked ? 'var(--os-accent)' : 'color-mix(in srgb, var(--os-muted) 30%, transparent)',
          transition: 'background 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <span
          style={{
            position: 'absolute', top: (RIEL_H - KNOB) / 2, left: (RIEL_H - KNOB) / 2,
            width: KNOB, height: KNOB, borderRadius: 'var(--os-r-full)', background: '#fff',
            transform: checked ? `translateX(${RIEL_W - KNOB - (RIEL_H - KNOB)}px)` : 'none',
            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(45, 55, 72, 0.30)',
          }}
        />
      </span>
    </button>
  );
}
