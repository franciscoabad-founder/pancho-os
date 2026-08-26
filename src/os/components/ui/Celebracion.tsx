// Celebracion: overlay efimero para cuando algo merece festejarse. Hoy lo usa
// el registro de wins en OSHoy. Serpentinas en CSS puro, sin dependencias.
//
// Uso:
//   const [festejo, setFestejo] = useState(false);
//   {festejo && <Celebracion mensaje="Win registrado" onCerrar={() => setFestejo(false)} />}
//
// Se cierra sola a los ~2.4s, o al hacer click. Respeta prefers-reduced-motion:
// si el usuario pidio menos animacion, queda el mensaje sin serpentinas.
import { useEffect, useMemo } from 'react';

// Paleta de serpentinas. Sin verde: en el OS "hecho" es champagne (ver Toast.tsx).
const COLORES = [
  'var(--os-champagne)',
  'var(--os-accent)',
  'var(--os-accent-light)',
  'var(--os-warn)',
];

const CANTIDAD = 24;
const DURACION_MS = 2400;

export interface CelebracionProps {
  mensaje: string;
  detalle?: string;
  onCerrar: () => void;
  duracionMs?: number;
}

export default function Celebracion({
  mensaje,
  detalle,
  onCerrar,
  duracionMs = DURACION_MS,
}: CelebracionProps) {
  // Se sortean una sola vez por montaje: recalcularlas en cada render haria
  // saltar las serpentinas de lugar a mitad de la caida.
  const serpentinas = useMemo(
    () => Array.from({ length: CANTIDAD }, (_, i) => ({
      id: i,
      izquierda: Math.random() * 100,
      retrasoMs: Math.round(Math.random() * 600),
      duracionS: (1.6 + Math.random() * 1.1).toFixed(2),
      color: COLORES[i % COLORES.length],
      ancho: Math.round(5 + Math.random() * 5),
      alto: Math.round(9 + Math.random() * 9),
    })),
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(onCerrar, duracionMs);
    return () => window.clearTimeout(t);
  }, [duracionMs, onCerrar]);

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        animation: 'os-celebra-entra 0.2s ease-out',
      }}
    >
      <style>{CSS_CELEBRACION}</style>

      <div className="os-celebra-lienzo" aria-hidden="true">
        {serpentinas.map((s) => (
          <span
            key={s.id}
            style={{
              position: 'absolute', top: -24, left: `${s.izquierda}%`,
              width: s.ancho, height: s.alto, background: s.color, borderRadius: 1,
              animation: `os-celebra-cae ${s.duracionS}s linear ${s.retrasoMs}ms forwards`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'relative', textAlign: 'center', padding: '0 1.5rem',
          animation: 'os-celebra-pop 0.4s cubic-bezier(0.2, 1.4, 0.4, 1)',
        }}
      >
        <p style={{
          fontFamily: 'var(--os-font-display)', fontWeight: 800,
          fontSize: 'clamp(1.75rem, 7vw, 3rem)', lineHeight: 1.1,
          color: 'var(--os-champagne)', margin: 0,
          textShadow: '0 2px 24px rgba(0,0,0,0.5)',
        }}>
          {mensaje}
        </p>
        {detalle && (
          <p style={{
            fontSize: 'var(--os-text-sm)', color: '#fff', opacity: 0.92,
            margin: '0.625rem auto 0', maxWidth: 420, lineHeight: 1.4,
          }}>
            {detalle}
          </p>
        )}
      </div>
    </div>
  );
}

const CSS_CELEBRACION = `
  .os-celebra-lienzo {
    position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  }
  @keyframes os-celebra-cae {
    from { transform: translateY(0) rotate(0deg); opacity: 1; }
    to   { transform: translateY(105vh) rotate(720deg); opacity: 0.15; }
  }
  @keyframes os-celebra-pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  @keyframes os-celebra-entra {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .os-celebra-lienzo { display: none; }
  }
`;
