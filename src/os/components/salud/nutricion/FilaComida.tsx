// Fila de una comida registrada. Tap (fuera de los botones) abre edicion inline:
// si tiene alimento_id se edita cantidad_g (recalcula macros server-side); si es
// entrada libre se editan descripcion + macros directos. Preserva borrar (DELETE).
import { useState } from 'react';
import type { Comida, Momento } from './tipos';
import { MOMENTOS, MOMENTO_LABEL } from './tipos';
import { input, sel, btn, btnGhost, btnIcon } from './estilos';
import { useConfirm } from '../../ui';

interface Props {
  comida: Comida;
  onCambio: () => void;
}

export default function FilaComida({ comida, onCambio }: Props) {
  const { confirm, sheet } = useConfirm();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esLibre = !comida.alimento_id;
  const [form, setForm] = useState({
    descripcion: comida.descripcion_libre ?? '',
    cantidad_g: comida.cantidad_g != null ? String(comida.cantidad_g) : '',
    kcal: comida.kcal != null ? String(comida.kcal) : '',
    proteina_g: comida.proteina_g != null ? String(comida.proteina_g) : '',
    carbos_g: comida.carbos_g != null ? String(comida.carbos_g) : '',
    grasa_g: comida.grasa_g != null ? String(comida.grasa_g) : '',
    momento: comida.momento as Momento,
  });

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const body: Record<string, unknown> = { momento: form.momento };
      if (esLibre) {
        body.descripcion_libre = form.descripcion;
        body.kcal = form.kcal || null;
        body.proteina_g = form.proteina_g || null;
        body.carbos_g = form.carbos_g || null;
        body.grasa_g = form.grasa_g || null;
      } else {
        body.cantidad_g = form.cantidad_g || null;
      }
      const res = await fetch(`/api/os/salud/comidas-log?id=${encodeURIComponent(comida.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEditando(false);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!(await confirm({
      title: 'Borrar entrada',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Borrar',
      danger: true,
    }))) return;
    await fetch(`/api/os/salud/comidas-log?id=${comida.id}`, { method: 'DELETE' });
    onCambio();
  }

  if (editando) {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--os-line-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>{error}</div>}
        <select style={{ ...sel, width: 'auto' }} value={form.momento} onChange={(e) => setForm({ ...form, momento: e.target.value as Momento })}>
          {MOMENTOS.map((m) => <option key={m} value={m}>{MOMENTO_LABEL[m]}</option>)}
        </select>
        {esLibre ? (
          <>
            <input style={input} placeholder="Que comiste" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <input style={input} type="number" placeholder="kcal" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
              <input style={input} type="number" placeholder="P (g)" value={form.proteina_g} onChange={(e) => setForm({ ...form, proteina_g: e.target.value })} />
              <input style={input} type="number" placeholder="C (g)" value={form.carbos_g} onChange={(e) => setForm({ ...form, carbos_g: e.target.value })} />
              <input style={input} type="number" placeholder="G (g)" value={form.grasa_g} onChange={(e) => setForm({ ...form, grasa_g: e.target.value })} />
            </div>
          </>
        ) : (
          <input style={input} type="number" min="0" placeholder="Cantidad (g)" value={form.cantidad_g} onChange={(e) => setForm({ ...form, cantidad_g: e.target.value })} />
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={btnGhost} onClick={() => setEditando(false)}>Cancelar</button>
          <button style={btn} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
      <button
        onClick={() => setEditando(true)}
        style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', minWidth: 0, flex: 1 }}
      >
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {comida.descripcion_libre || 'Alimento'}{comida.cantidad_g ? ` · ${comida.cantidad_g}g` : ''}
        </p>
        <p style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)', margin: '2px 0 0' }}>
          {Math.round(comida.kcal ?? 0)} kcal · P{Math.round(comida.proteina_g ?? 0)} C{Math.round(comida.carbos_g ?? 0)} G{Math.round(comida.grasa_g ?? 0)}
        </p>
      </button>
      <button style={btnIcon} onClick={borrar} title="Borrar">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
      </button>
      {sheet}
    </div>
  );
}
