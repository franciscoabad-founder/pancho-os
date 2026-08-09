// Anillo de progreso SVG para un macro (estilo Yazio). Usa colorMacro/pctAnillo de
// tipos.ts para que la logica de estado (accent / champagne / coral) sea unica.
import { colorMacro, pctAnillo, round } from './tipos';

interface Props {
  label: string;
  consumido: number;
  target: number | null;
  size?: number;
  grosor?: number;
  onConfigurar?: () => void;
}

export default function MacroRing({ label, consumido, target, size = 84, grosor = 8, onConfigurar }: Props) {
  const r = (size - grosor) / 2;
  const C = 2 * Math.PI * r;
  const pct = pctAnillo(consumido, target);
  const color = colorMacro(consumido, target);
  const sinMeta = target == null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--os-line-soft)" strokeWidth={grosor} />
          {!sinMeta && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={grosor}
              strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
              style={{ transition: 'stroke-dasharray .4s, stroke .3s' }}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {sinMeta ? (
            <button
              onClick={onConfigurar}
              style={{ background: 'none', border: 'none', color: 'var(--os-accent-light)', fontSize: 11, textAlign: 'center', cursor: 'pointer', padding: 0, lineHeight: 1.2 }}
            >
              Configurar
            </button>
          ) : (
            <>
              <span style={{ fontFamily: 'var(--os-font-rounded)', fontWeight: 800, fontSize: size * 0.22, color: 'var(--os-text)', lineHeight: 1 }}>
                {round(consumido)}
              </span>
              <span style={{ fontSize: size * 0.1, color: 'var(--os-muted)', lineHeight: 1, marginTop: 2 }}>/ {target}g</span>
            </>
          )}
        </div>
      </div>
      <span style={{ fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-text-2)', fontFamily: 'var(--os-font-display)' }}>{label}</span>
    </div>
  );
}
