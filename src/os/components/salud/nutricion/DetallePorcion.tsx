// Detalle de porcion de un alimento (abierto al tocar una fila de resultados en
// Buscar): selector de porciones (+ gramos siempre disponible), cantidad, preview
// de macros en vivo, toggle de favorito y CTA "Agregar".
import { useMemo, useState } from 'react';
import type { Alimento, Momento } from './tipos';
import { gramosEfectivos, previewMacros } from './tipos';
import { input, sel, btn, btnGhost, btnIcon } from './estilos';

interface Props {
  alimento: Alimento;
  momento: Momento;
  dia: string;
  tipoDia: string;
  onCerrar: () => void;
  onAgregado: () => void;
}

export default function DetallePorcion({ alimento, momento, dia, tipoDia, onCerrar, onAgregado }: Props) {
  const [porcionId, setPorcionId] = useState<string>('gramos');
  const [cantidad, setCantidad] = useState('100');
  const [favorito, setFavorito] = useState(!!alimento.favorito);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const porcionSel = porcionId === 'gramos' ? null : alimento.alimento_porciones.find((p) => p.id === porcionId) ?? null;
  const gramos = useMemo(() => gramosEfectivos(Number(cantidad) || 0, porcionSel), [cantidad, porcionSel]);
  const preview = useMemo(() => previewMacros(alimento, gramos), [alimento, gramos]);

  async function toggleFavorito() {
    const nuevo = !favorito;
    setFavorito(nuevo);
    try {
      await fetch(`/api/os/salud/alimentos?id=${alimento.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorito: nuevo }),
      });
    } catch { setFavorito(!nuevo); }
  }

  async function agregar() {
    setGuardando(true); setError('');
    try {
      const body: Record<string, unknown> = {
        alimento_id: alimento.id, momento, fecha: dia, tipo_dia: tipoDia,
        descripcion_libre: alimento.nombre,
      };
      if (porcionSel) {
        body.porcion_id = porcionSel.id;
        body.cantidad = Number(cantidad) || 0;
      } else {
        body.cantidad_g = Number(cantidad) || 0;
      }
      const res = await fetch('/api/os/salud/comidas-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onAgregado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={btnGhost} onClick={onCerrar}>‹ Volver</button>
          <span style={{ fontWeight: 700, color: 'var(--os-text)', fontSize: 'var(--os-text-base)' }}>{alimento.nombre}</span>
        </div>
        <button style={btnIcon} onClick={toggleFavorito} title="Favorito">
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: favorito ? 'var(--os-champagne)' : 'var(--os-muted)', fontVariationSettings: favorito ? "'FILL' 1" : "'FILL' 0" }}>
            star
          </span>
        </button>
      </div>

      {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...input, width: 90 }} type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <select style={{ ...sel, width: 'auto', flex: 1 }} value={porcionId} onChange={(e) => setPorcionId(e.target.value)}>
          <option value="gramos">gramos</option>
          {alimento.alimento_porciones.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.gramos}g)</option>)}
        </select>
        {porcionSel && <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>= {gramos} g</span>}
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 'var(--os-text-sm)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-text-2)', flexWrap: 'wrap' }}>
        <span>{preview.kcal} kcal</span><span>P {preview.proteina_g}g</span>
        <span>C {preview.carbos_g}g</span><span>G {preview.grasa_g}g</span>
      </div>

      <button style={btn} disabled={guardando || gramos <= 0} onClick={agregar}>
        {guardando ? 'Agregando...' : 'Agregar'}
      </button>
    </div>
  );
}
