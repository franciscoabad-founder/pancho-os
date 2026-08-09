import { useEffect, useState } from 'react';
import type { Ejercicio } from './tipos';
import { nombreEjercicio, chipsGrupo } from './tipos';
import { thumb, chip } from './estilos';
import { Sheet, Spinner, EmptyState } from '../ui';

interface Props {
  ejercicioActualId: string;
  onCerrar: () => void;
  onElegir: (ejercicio: Ejercicio) => void;
}

// Sheet de swap: alternativas del mismo patrón/grupo muscular (?alternativas=id).
export default function OSGfitSwapSheet({ ejercicioActualId, onCerrar, onElegir }: Props) {
  const [alternativas, setAlternativas] = useState<Ejercicio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    fetch(`/api/os/gfit/catalogo?alternativas=${ejercicioActualId}`)
      .then((r) => r.json())
      .then((d) => { if (vivo) setAlternativas(d.alternativas ?? []); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [ejercicioActualId]);

  return (
    <Sheet open onClose={onCerrar} title="Cambiar ejercicio">
      {loading && <Spinner label="Buscando alternativas..." />}
      {!loading && !alternativas.length && (
        <EmptyState icon="swap_horiz" title="Sin alternativas" text="No hay ejercicios del mismo patrón o grupo muscular en el catálogo." />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alternativas.map((alt) => (
          <button
            key={alt.id}
            onClick={() => onElegir(alt)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
              background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)', borderRadius: 14,
              padding: '8px 10px', cursor: 'pointer', minHeight: 56,
            }}
          >
            {alt.imagenes?.[0]
              ? <img src={alt.imagenes[0]} alt="" loading="lazy" style={{ ...thumb(44), borderRadius: 999 }} />
              : <div style={{ ...thumb(44), borderRadius: 999 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nombreEjercicio(alt)}
              </p>
              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                {chipsGrupo(alt).slice(0, 2).map((g) => <span key={g} style={chip}>{g}</span>)}
              </div>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-accent-light)', flexShrink: 0 }}>swap_horiz</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
