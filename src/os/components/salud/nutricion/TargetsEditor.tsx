// Editor inline de metas (kcal_objetivo, proteina_objetivo_g, carbos_objetivo_g,
// grasa_objetivo_g). PATCH /api/os/salud/config. Se abre desde "Configura tus metas".
import { useState } from 'react';
import { card2, input, btn, btnGhost, eyebrow } from './estilos';

interface Props {
  valores: { kcal: number | null; proteina_g: number | null; carbos_g: number | null; grasa_g: number | null };
  onGuardado: () => void;
  onCerrar: () => void;
}

export default function TargetsEditor({ valores, onGuardado, onCerrar }: Props) {
  const [form, setForm] = useState({
    kcal_objetivo: valores.kcal != null ? String(valores.kcal) : '',
    proteina_objetivo_g: valores.proteina_g != null ? String(valores.proteina_g) : '',
    carbos_objetivo_g: valores.carbos_g != null ? String(valores.carbos_g) : '',
    grasa_objetivo_g: valores.grasa_g != null ? String(valores.grasa_g) : '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setGuardando(true); setError('');
    try {
      const body: Record<string, number | null> = {};
      for (const k of ['kcal_objetivo', 'proteina_objetivo_g', 'carbos_objetivo_g', 'grasa_objetivo_g'] as const) {
        const v = form[k].trim();
        body[k] = v === '' ? null : Number(v);
      }
      const res = await fetch('/api/os/salud/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar metas');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ ...card2, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={eyebrow}>Tus metas diarias</p>
      {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--os-muted)' }}>
          Calorias (kcal)
          <input style={input} type="number" min="0" value={form.kcal_objetivo}
            onChange={(e) => setForm({ ...form, kcal_objetivo: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--os-muted)' }}>
          Proteina (g)
          <input style={input} type="number" min="0" value={form.proteina_objetivo_g}
            onChange={(e) => setForm({ ...form, proteina_objetivo_g: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--os-muted)' }}>
          Carbohidratos (g)
          <input style={input} type="number" min="0" value={form.carbos_objetivo_g}
            onChange={(e) => setForm({ ...form, carbos_objetivo_g: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--os-muted)' }}>
          Grasa (g)
          <input style={input} type="number" min="0" value={form.grasa_objetivo_g}
            onChange={(e) => setForm({ ...form, grasa_objetivo_g: e.target.value })} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={btnGhost} onClick={onCerrar}>Cancelar</button>
        <button style={btn} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar metas'}</button>
      </div>
    </div>
  );
}
