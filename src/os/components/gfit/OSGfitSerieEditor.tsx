import { useState } from 'react';
import type { SeriePlan, TipoSerie, UnidadPeso } from './tipos';
import { TIPO_SERIE_COLOR, TIPO_SERIE_DEF, TIPOS_SERIE_ORDEN, etiquetasSeries, siguienteTipoSerie } from './tipos';
import { formatearPeso, pesoDesdeInput } from '../../../lib/gfit/unidades';
import { btnGhost, input } from './estilos';

interface Props {
  dia_ejercicio_id: string;
  series: SeriePlan[];
  unidad: UnidadPeso;
  onCambio: (series: SeriePlan[]) => void; // actualización optimista hacia el padre
}

// Editor de series estilo Jefit: badge de tipo (tap = cicla), peso/reps/descanso.
export default function OSGfitSerieEditor({ dia_ejercicio_id, series, unidad, onCambio }: Props) {
  const [ayuda, setAyuda] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const etiquetas = etiquetasSeries(series);

  async function patchSerie(id: string, body: Record<string, unknown>, optimista: Partial<SeriePlan>) {
    onCambio(series.map((s) => (s.id === id ? { ...s, ...optimista } : s)));
    setGuardandoId(id);
    try {
      await fetch(`/api/os/gfit/series?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } finally {
      setGuardandoId((cur) => (cur === id ? null : cur));
    }
  }

  async function agregarSerie() {
    const res = await fetch('/api/os/gfit/series', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia_ejercicio_id, tipo: 'working', reps: 10, descanso_s: 90 }),
    });
    const data = await res.json();
    if (data?.serie) onCambio([...series, data.serie]);
  }

  async function eliminarSerie(id: string) {
    onCambio(series.filter((s) => s.id !== id));
    await fetch(`/api/os/gfit/series?id=${id}`, { method: 'DELETE' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', padding: '0 2px' }}>
        <span />
        <span style={{ fontSize: 11, color: 'var(--os-muted)', fontFamily: 'var(--os-font-display)' }}>Peso ({unidad})</span>
        <span style={{ fontSize: 11, color: 'var(--os-muted)', fontFamily: 'var(--os-font-display)' }}>Reps</span>
        <span style={{ fontSize: 11, color: 'var(--os-muted)', fontFamily: 'var(--os-font-display)' }}>Desc. (s)</span>
        <span />
      </div>

      {series.map((s, i) => (
        <SerieFila
          key={s.id}
          serie={s}
          etiqueta={etiquetas[i]}
          unidad={unidad}
          guardando={guardandoId === s.id}
          onTipo={() => patchSerie(s.id, { tipo: siguienteTipoSerie(s.tipo) }, { tipo: siguienteTipoSerie(s.tipo) })}
          onPeso={(valor) => {
            const kg = pesoDesdeInput(valor, unidad);
            patchSerie(s.id, { peso: valor, unidad }, { peso_kg: kg });
          }}
          onReps={(valor) => patchSerie(s.id, { reps: valor }, { reps: valor })}
          onDescanso={(valor) => patchSerie(s.id, { descanso_s: valor }, { descanso_s: valor })}
          onEliminar={() => eliminarSerie(s.id)}
        />
      ))}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
        <button style={{ ...btnGhost, flex: 1 }} onClick={agregarSerie}>+ Agregar serie</button>
        <button style={{ ...btnGhost, padding: '9px 10px' }} onClick={() => setAyuda(!ayuda)} title="Conoce tus tipos de serie">
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>help</span>
        </button>
      </div>

      {ayuda && (
        <div style={{ ...input, background: 'var(--os-fill-subtle)', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>Conoce tus tipos de serie</p>
          {TIPOS_SERIE_ORDEN.map((t) => (
            <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: TIPO_SERIE_COLOR[t], flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{TIPO_SERIE_DEF[t].titulo}</p>
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{TIPO_SERIE_DEF[t].texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SerieFila({ serie, etiqueta, unidad, guardando, onTipo, onPeso, onReps, onDescanso, onEliminar }: {
  serie: SeriePlan; etiqueta: string; unidad: UnidadPeso; guardando: boolean;
  onTipo: () => void; onPeso: (v: number) => void; onReps: (v: number) => void; onDescanso: (v: number) => void; onEliminar: () => void;
}) {
  const [peso, setPeso] = useState(serie.peso_kg != null ? String(formatearPeso(serie.peso_kg, unidad)) : '');
  const [reps, setReps] = useState(serie.reps != null ? String(serie.reps) : '');
  const [descanso, setDescanso] = useState(serie.descanso_s != null ? String(serie.descanso_s) : '');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 1fr 1fr 30px', gap: 6, alignItems: 'center', opacity: guardando ? 0.6 : 1 }}>
      <button
        onClick={onTipo}
        style={{
          width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: TIPO_SERIE_COLOR[serie.tipo], color: '#fff', fontFamily: 'var(--os-font-display)',
          fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
        title="Tocar para cambiar el tipo de serie"
      >
        {etiqueta}
      </button>
      <input
        style={{ ...input, padding: '8px 8px', textAlign: 'center', fontSize: 14 }}
        type="number" inputMode="decimal" placeholder="-" value={peso}
        onChange={(e) => setPeso(e.target.value)}
        onBlur={() => onPeso(Number(peso) || 0)}
      />
      <input
        style={{ ...input, padding: '8px 8px', textAlign: 'center', fontSize: 14 }}
        type="number" inputMode="numeric" placeholder="-" value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => onReps(Number(reps) || 0)}
      />
      <input
        style={{ ...input, padding: '8px 8px', textAlign: 'center', fontSize: 14 }}
        type="number" inputMode="numeric" placeholder="-" value={descanso}
        onChange={(e) => setDescanso(e.target.value)}
        onBlur={() => onDescanso(Number(descanso) || 0)}
      />
      <button style={{ background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer', fontSize: 16 }} onClick={onEliminar} aria-label="Eliminar serie">✕</button>
    </div>
  );
}
