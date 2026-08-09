// Desglose expandible: tabla de micro-nutrientes sumados a partir de las columnas
// snapshot de comidas_log. Se usa tanto a nivel de dia como por momento. Oculta
// filas donde ninguna entrada tiene dato (todas null).
import { useState } from 'react';
import type { Comida } from './tipos';
import { COLUMNAS_DESGLOSE, sumarColumna } from './tipos';

export default function Desglose({ comidas }: { comidas: Comida[] }) {
  const [abierto, setAbierto] = useState(false);

  const filas = COLUMNAS_DESGLOSE
    .map((c) => ({ ...c, valor: sumarColumna(comidas, c.col) }))
    .filter((f) => f.valor != null);

  if (!comidas.length) return null;

  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          background: 'none', border: 'none', color: 'var(--os-accent-light)', fontSize: 'var(--os-text-xs)',
          fontFamily: 'var(--os-font-display)', fontWeight: 700, cursor: 'pointer', padding: '4px 0', minHeight: 36,
          display: 'flex', alignItems: 'center', gap: 3,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{abierto ? 'expand_less' : 'expand_more'}</span>
        Ver desglose
      </button>
      {abierto && (
        filas.length === 0 ? (
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '4px 0 0' }}>Sin micronutrientes registrados.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
            <tbody>
              {filas.map((f) => (
                <tr key={f.col as string} style={{ borderBottom: '1px solid var(--os-line-soft)' }}>
                  <td style={{ padding: '5px 0', fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)' }}>{f.label}</td>
                  <td style={{ padding: '5px 0', fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text)', textAlign: 'right' }}>
                    {f.valor}{f.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
