// Tab "Buscar" del sheet de captura: input libre (existing logic: /api/os/salud/
// alimentos?q=) + pills Recientes/Frecuentes/Favoritas (?modo=) cuando no hay texto.
// Tocar una fila (no el "+") abre DetallePorcion; el "+" agrega de una con 100 g.
import { useEffect, useState } from 'react';
import type { Alimento, Momento, ModoBusqueda } from './tipos';
import { MODOS_BUSQUEDA } from './tipos';
import { input, pill, btnPlus, rowItem } from './estilos';
import { Spinner, EmptyState } from '../../ui';
import DetallePorcion from './DetallePorcion';

interface Props {
  momento: Momento;
  dia: string;
  tipoDia: string;
  onAgregado: () => void;
}

export default function TabBuscar({ momento, dia, tipoDia, onAgregado }: Props) {
  const [q, setQ] = useState('');
  const [modo, setModo] = useState<ModoBusqueda>('recientes');
  const [resultados, setResultados] = useState<Alimento[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [sel, setSel] = useState<Alimento | null>(null);
  const [agregandoRapido, setAgregandoRapido] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setBuscando(true);
    const url = q.trim()
      ? `/api/os/salud/alimentos?q=${encodeURIComponent(q.trim())}`
      : `/api/os/salud/alimentos?modo=${modo}`;
    const t = setTimeout(() => {
      fetch(url).then((r) => r.json()).then((d) => { if (vivo) setResultados(d.alimentos ?? []); })
        .catch(() => { if (vivo) setResultados([]); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, q.trim() ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, modo]);

  async function agregarRapido(a: Alimento) {
    setAgregandoRapido(a.id);
    try {
      const res = await fetch('/api/os/salud/comidas-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alimento_id: a.id, cantidad_g: 100, momento, fecha: dia, tipo_dia: tipoDia, descripcion_libre: a.nombre }),
      });
      const data = await res.json();
      if (!data.error) onAgregado();
    } finally {
      setAgregandoRapido(null);
    }
  }

  if (sel) {
    return (
      <DetallePorcion
        alimento={sel} momento={momento} dia={dia} tipoDia={tipoDia}
        onCerrar={() => setSel(null)}
        onAgregado={onAgregado}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Buscar (pollo, arroz, banano...)" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q.trim() && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MODOS_BUSQUEDA.map((m) => (
            <button key={m.key} style={pill(modo === m.key)} onClick={() => setModo(m.key)}>{m.label}</button>
          ))}
        </div>
      )}

      {buscando && <Spinner inline label="Buscando..." />}
      {!buscando && resultados.length === 0 && (
        q.trim()
          ? <EmptyState icon="search_off" title="Sin resultados" text='Prueba con otro termino o usa "Mas" para una entrada libre.' />
          : <EmptyState icon="restaurant" title="Nada por aqui todavia" text="Busca un alimento para empezar a registrar." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
        {resultados.map((a) => (
          <div key={a.id} style={rowItem}>
            <button
              onClick={() => setSel(a)}
              style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', flex: 1, minWidth: 0 }}
            >
              <p style={{ margin: 0, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.nombre}{a.marca ? ` · ${a.marca}` : ''}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)' }}>
                {a.kcal} kcal / 100 g
              </p>
            </button>
            <button style={btnPlus} disabled={agregandoRapido === a.id} onClick={() => agregarRapido(a)} title="Agregar 100 g">
              {agregandoRapido === a.id ? '…' : '+'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
