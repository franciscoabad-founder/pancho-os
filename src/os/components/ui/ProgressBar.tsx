// ProgressBar — barra determinada (pill). Reemplaza las ~13 barras
// hand-rolled del OS (div track + div fill con width en %) de Finanzas, GFIT,
// Salud y onboarding, y las .m-bar del modulo conductual.
// Forma: pill completo por la regla de radios del design system.
import type { CSSProperties } from 'react';

export type ProgressTone = 'accent' | 'metric' | 'warn' | 'error';
export type ProgressSize = 'sm' | 'md';

export interface ProgressBarProps {
  value: number;
  /** Tope de la escala. 100 = el value ya viene en porcentaje. */
  max?: number;
  /** Texto a la izquierda sobre la barra. */
  label?: string;
  /**
   * Texto a la derecha sobre la barra. Sin este prop y con label presente se
   * muestra el porcentaje calculado.
   */
  valueLabel?: string;
  tone?: ProgressTone;
  size?: ProgressSize;
  /** Etiqueta accesible cuando no hay label visible. */
  ariaLabel?: string;
  style?: CSSProperties;
}

const TONOS: Record<ProgressTone, string> = {
  accent: 'var(--os-accent)',
  metric: 'var(--os-champagne)',
  warn: 'var(--os-warn)',
  error: 'var(--os-error)',
};

const ALTURAS: Record<ProgressSize, number> = { sm: 6, md: 10 };

export default function ProgressBar({
  value, max = 100, label, valueLabel, tone = 'accent', size = 'md', ariaLabel, style,
}: ProgressBarProps) {
  // El clamp vive aca para que ningun consumidor pueda desbordar la barra.
  const seguro = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const pct = max > 0 ? (seguro / max) * 100 : 0;
  const alto = ALTURAS[size];

  return (
    <div style={style}>
      {(label || valueLabel) && (
        <div
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 8, marginBottom: 5,
          }}
        >
          {label && (
            <span
              style={{
                fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)',
                fontWeight: 600, letterSpacing: '0.04em', color: 'var(--os-muted)',
                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--os-font-mono)', fontSize: 'var(--os-text-xs)',
              fontWeight: 700, color: 'var(--os-champagne)', flexShrink: 0,
            }}
          >
            {valueLabel ?? `${Math.round(pct)}%`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={seguro}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={ariaLabel ?? label}
        style={{
          height: alto, width: '100%', overflow: 'hidden',
          background: 'var(--os-surface-3)', borderRadius: 'var(--os-r-full)',
        }}
      >
        <div
          style={{
            height: '100%', width: `${pct}%`, background: TONOS[tone],
            borderRadius: 'var(--os-r-full)', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}
