import { useEffect, useState } from 'react';
import type { Dia, DiaEjercicio, Ejercicio, UnidadPeso } from './tipos';
import { chipsGrupo, nombreEjercicio, resumenSeries } from './tipos';
import { card, card2, input, btnGhost, btnIcon, thumb, chip } from './estilos';
import { Spinner, EmptyState, useConfirm } from '../ui';
import OSGfitBodyMap from './OSGfitBodyMap';
import OSGfitSerieEditor from './OSGfitSerieEditor';
import OSGfitSwapSheet from './OSGfitSwapSheet';

interface Props {
  dia: Dia;
  unidad: UnidadPeso;
  onDia: (dia: Dia) => void;
  onVolver: () => void;
}

export default function OSGfitDia({ dia, unidad, onDia, onVolver }: Props) {
  const { confirm, sheet } = useConfirm();
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [buscador, setBuscador] = useState('');
  const [resultados, setResultados] = useState<Ejercicio[]>([]);
  const [buscando, setBuscando] = useState(false);

  const items = [...dia.gfit_dia_ejercicios].sort((a, b) => a.orden - b.orden);

  useEffect(() => {
    if (!buscador.trim()) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/os/gfit/catalogo?q=${encodeURIComponent(buscador.trim())}&limit=10`);
      const data = await res.json();
      setResultados(data.ejercicios ?? []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [buscador]);

  function actualizarItem(id: string, patch: Partial<DiaEjercicio>) {
    onDia({ ...dia, gfit_dia_ejercicios: dia.gfit_dia_ejercicios.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  }

  async function mover(idx: number, dir: number) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[idx], copia[j]] = [copia[j], copia[idx]];
    const reordenados = copia.map((it, i) => ({ ...it, orden: i }));
    onDia({ ...dia, gfit_dia_ejercicios: reordenados });
    await fetch('/api/os/gfit/dia-ejercicios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reordenar: reordenados.map((it) => ({ id: it.id, orden: it.orden })) }),
    });
  }

  async function toggleSuperset(idx: number) {
    setMenuId(null);
    const actual = items[idx];
    if (actual.superset_grupo) {
      const grupo = actual.superset_grupo;
      const afectados = items.filter((it) => it.superset_grupo === grupo);
      onDia({ ...dia, gfit_dia_ejercicios: dia.gfit_dia_ejercicios.map((it) => (it.superset_grupo === grupo ? { ...it, superset_grupo: null } : it)) });
      await Promise.all(afectados.map((it) =>
        fetch(`/api/os/gfit/dia-ejercicios?id=${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ superset_grupo: null }) }),
      ));
      return;
    }
    const siguiente = items[idx + 1];
    if (!siguiente) return;
    const nuevoGrupo = Math.max(0, ...items.map((it) => it.superset_grupo ?? 0)) + 1;
    onDia({
      ...dia, gfit_dia_ejercicios: dia.gfit_dia_ejercicios.map((it) =>
        it.id === actual.id || it.id === siguiente.id ? { ...it, superset_grupo: nuevoGrupo } : it),
    });
    await Promise.all([actual.id, siguiente.id].map((id) =>
      fetch(`/api/os/gfit/dia-ejercicios?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ superset_grupo: nuevoGrupo }) }),
    ));
  }

  async function eliminar(id: string) {
    setMenuId(null);
    if (!(await confirm({
      title: 'Quitar ejercicio',
      text: 'Se quita este ejercicio del dia.',
      confirmLabel: 'Quitar',
      danger: true,
    }))) return;
    onDia({ ...dia, gfit_dia_ejercicios: dia.gfit_dia_ejercicios.filter((it) => it.id !== id) });
    await fetch(`/api/os/gfit/dia-ejercicios?id=${id}`, { method: 'DELETE' });
  }

  async function confirmarSwap(ejercicioId: string, nuevo: Ejercicio) {
    setSwapId(null);
    const res = await fetch(`/api/os/gfit/dia-ejercicios?id=${ejercicioId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ejercicio_id: nuevo.id }),
    });
    const data = await res.json();
    if (data?.dia_ejercicio) actualizarItem(ejercicioId, data.dia_ejercicio);
  }

  async function agregarEjercicio(e: Ejercicio) {
    setBuscador(''); setResultados([]);
    const res = await fetch('/api/os/gfit/dia-ejercicios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia_id: dia.id, ejercicio_id: e.id }),
    });
    const data = await res.json();
    if (data?.dia_ejercicio) onDia({ ...dia, gfit_dia_ejercicios: [...dia.gfit_dia_ejercicios, data.dia_ejercicio] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--os-text)' }}>{dia.nombre}</span>
        <button style={btnGhost} onClick={onVolver}>← Días</button>
      </div>

      <OSGfitBodyMap dia={dia} />

      {!items.length && (
        <EmptyState
          icon="fitness_center"
          title="Sin ejercicios todavía"
          text="Usa el buscador de abajo para agregar el primero."
        />
      )}

      {items.map((it, idx) => {
        const siguienteMismoGrupo = it.superset_grupo != null && items[idx + 1]?.superset_grupo === it.superset_grupo;
        return (
          <div key={it.id} style={{ position: 'relative', paddingLeft: it.superset_grupo != null ? 10 : 0 }}>
            {it.superset_grupo != null && (
              <div style={{ position: 'absolute', left: 0, top: siguienteMismoGrupo ? 8 : -6, bottom: siguienteMismoGrupo ? -6 : 8, width: 3, borderRadius: 3, background: 'var(--os-accent)' }} />
            )}
            <div style={card}>
              <div style={{ display: 'flex', gap: 10 }}>
                {it.ejercicio?.imagenes?.[0]
                  ? <img src={it.ejercicio.imagenes[0]} alt="" loading="lazy" style={thumb(58)} />
                  : <div style={thumb(58)} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: 0, cursor: 'pointer' }}
                      onClick={() => setExpandidoId(expandidoId === it.id ? null : it.id)}>
                      {nombreEjercicio(it.ejercicio)}
                    </p>
                    <button style={btnIcon} onClick={() => setMenuId(menuId === it.id ? null : it.id)} aria-label="Más opciones">
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '3px 0' }}>
                    {chipsGrupo(it.ejercicio).map((g) => <span key={g} style={chip}>{g}</span>)}
                  </div>
                  <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>{resumenSeries(it.gfit_series_plan)}</p>
                </div>
              </div>

              {menuId === it.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button style={btnGhost} onClick={() => { setMenuId(null); setSwapId(it.id); }}>Cambiar</button>
                  <button style={btnGhost} onClick={() => toggleSuperset(idx)}>{it.superset_grupo != null ? 'Quitar superset' : 'Superset'}</button>
                  <button style={{ ...btnGhost, color: 'var(--os-error)' }} onClick={() => eliminar(it.id)}>Eliminar</button>
                  <button style={{ ...btnIcon, border: '1px solid var(--os-line)' }} disabled={idx === 0} onClick={() => mover(idx, -1)} aria-label="Subir">↑</button>
                  <button style={{ ...btnIcon, border: '1px solid var(--os-line)' }} disabled={idx === items.length - 1} onClick={() => mover(idx, 1)} aria-label="Bajar">↓</button>
                </div>
              )}

              {expandidoId === it.id && (
                <OSGfitSerieEditor
                  dia_ejercicio_id={it.id}
                  series={it.gfit_series_plan}
                  unidad={unidad}
                  onCambio={(series) => actualizarItem(it.id, { gfit_series_plan: series })}
                />
              )}
            </div>
          </div>
        );
      })}

      <div style={card2}>
        <input style={input} placeholder="Agregar ejercicio (buscar)..." value={buscador} onChange={(e) => setBuscador(e.target.value)} />
        {buscando && <div style={{ margin: '6px 0 0' }}><Spinner inline label="Buscando..." /></div>}
        {resultados.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {resultados.map((e) => (
              <button key={e.id} style={{ ...btnGhost, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => agregarEjercicio(e)}>
                {nombreEjercicio(e)}
              </button>
            ))}
          </div>
        )}
      </div>

      {swapId && (
        <OSGfitSwapSheet
          ejercicioActualId={items.find((it) => it.id === swapId)?.ejercicio_id ?? ''}
          onCerrar={() => setSwapId(null)}
          onElegir={(nuevo) => confirmarSwap(swapId, nuevo)}
        />
      )}
      {sheet}
    </div>
  );
}
