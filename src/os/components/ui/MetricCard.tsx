// MetricCard — tile de KPI estandar. Reemplaza el patron .os-kpi hand-rolled
// (div.os-kpi > p.os-kpi-label + p.os-kpi-value) repetido en Finanzas, CRM y
// Aprobaciones, y le agrega tendencia e icono sin duplicar markup.
// Regla de color: el numero va en champagne porque los numeros son prueba;
// ultramarine queda reservado para accion/CTA.
import type { CSSProperties, ReactNode } from 'react';

/** Tono de la tendencia. Se infiere del signo si no se pasa explicito. */
export type MetricTrendTone = 'ok' | 'warn' | 'error' | 'neutral';
export type MetricCardSize = 'md' | 'lg';

export interface MetricCardProps {
  /** Eyebrow en mayusculas (contrato .os-kpi-label). */
  label: string;
  /** Valor ya formateado por el consumidor (moneda, unidad, porcentaje). */
  value: ReactNode;
  /** Tendencia ya formateada, ej. '+12%' o '-3 dias'. */
  trend?: string;
  /**
   * Tono de la tendencia. Sin este prop se infiere del signo (+ = ok,
   * - = error). Se pasa explicito cuando subir es malo (deudas, gastos).
   */
  trendTone?: MetricTrendTone;
  /** Nombre de Material Symbol (ej. 'savings') o nodo propio. */
  icon?: string | ReactNode;
  /** Nota corta bajo el valor (contexto, periodo, meta). */
  hint?: string;
  /** Borde acentuado para el KPI principal del grupo (equivalente al 'Neto'). */
  accent?: boolean;
  size?: MetricCardSize;
  style?: CSSProperties;
}

const TAMANOS: Record<MetricCardSize, CSSProperties> = {
  md: { fontSize: '1.375rem' },
  lg: { fontSize: '2rem' },
};

const TONOS: Record<MetricTrendTone, string> = {
  ok: 'var(--os-ok)',
  warn: 'var(--os-warn)',
  error: 'var(--os-error)',
  neutral: 'var(--os-muted)',
};

// Sin prop explicito el signo decide: subir es bueno. Los modulos donde subir
// es malo (deudas, gastos) pasan trendTone a mano.
function tonoPorSigno(trend: string): MetricTrendTone {
  if (trend.trim().startsWith('+')) return 'ok';
  if (trend.trim().startsWith('-')) return 'error';
  return 'neutral';
}

export default function MetricCard({
  label, value, trend, trendTone, icon, hint, accent = false, size = 'md', style,
}: MetricCardProps) {
  const tono = TONOS[trendTone ?? (trend ? tonoPorSigno(trend) : 'neutral')];
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'var(--os-surface-2)',
        border: `1px solid ${accent ? 'var(--os-line-accent)' : 'var(--os-line-soft)'}`,
        borderRadius: 'var(--os-r-card)', padding: '0.875rem 1rem',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {typeof icon === 'string' ? (
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: 16, color: accent ? 'var(--os-accent-light)' : 'var(--os-muted)', flexShrink: 0 }}
          >
            {icon}
          </span>
        ) : icon}
        <p
          style={{
            margin: 0, fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: accent ? 'var(--os-accent-light)' : 'var(--os-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {label}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <p
          style={{
            margin: 0, fontFamily: 'var(--os-font-mono)', fontWeight: 700,
            color: 'var(--os-champagne)', lineHeight: 1.05, ...TAMANOS[size],
          }}
        >
          {value}
        </p>
        {trend && (
          <span
            style={{
              fontFamily: 'var(--os-font-mono)', fontSize: 'var(--os-text-xs)',
              fontWeight: 700, color: tono, whiteSpace: 'nowrap',
            }}
          >
            {trend}
          </span>
        )}
      </div>

      {hint && (
        <p style={{ margin: 0, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
