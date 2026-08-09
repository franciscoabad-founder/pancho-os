import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner, EmptyState, useConfirm } from '../ui';
import { promedioMovil } from '../../../lib/salud/progresion';

interface Medicion {
  id: string; fecha: string; peso_kg: number | null; grasa_pct: number | null;
  musculo_kg: number | null; agua_pct: number | null; cintura_cm: number | null;
  sueno_horas: number | null; source: string; notas: string | null;
}

const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};
const input: React.CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)',
  padding: '7px 10px', fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontFamily: 'var(--os-font-body)', outline: 'none', width: '100%', minHeight: 40,
};
const TZ = 'America/Guayaquil';
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

function LineChart({ crudo, media, height = 150 }: { crudo: { x: string; y: number }[]; media: { x: string; y: number }[]; height?: number }) {
  const todos = [...crudo, ...media];
  if (!todos.length) return <EmptyState icon="monitoring" title="Sin datos aún" text="Registra tu primera medición para ver la tendencia." />;
  const xs = Array.from(new Set(todos.map((p) => p.x))).sort();
  const maxY = Math.max(...todos.map((p) => p.y));
  const minY = Math.min(...todos.map((p) => p.y));
  const W = 320, H = height, pad = 8;
  const xPos = (x: string) => pad + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * (W - pad * 2);
  const yPos = (y: number) => H - pad - ((y - minY) / Math.max(0.5, maxY - minY)) * (H - pad * 2);
  const linea = (pts: { x: string; y: number }[]) =>
    [...pts].sort((a, b) => (a.x < b.x ? -1 : 1)).map((p, j) => `${j === 0 ? 'M' : 'L'} ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`).join(' ');
  return (
    <div className="os-hscroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ minWidth: 280 }}>
        <path d={linea(crudo)} fill="none" stroke="var(--os-accent-light)" strokeOpacity="0.4" strokeWidth="1.5" />
        <path d={linea(media)} fill="none" stroke="var(--os-champagne)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function OSSaludCuerpo() {
  const { confirm, sheet } = useConfirm();
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fecha: hoyISO(), peso_kg: '', grasa_pct: '', musculo_kg: '', agua_pct: '', cintura_cm: '', sueno_horas: '' });
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setLoading(true);
    const res = await fetch('/api/os/salud/cuerpo');
    const data = await res.json();
    if (data.error) setError(data.error); else setMediciones(data.mediciones ?? []);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!form.peso_kg && !form.grasa_pct && !form.musculo_kg && !form.agua_pct && !form.cintura_cm && !form.sueno_horas) {
      setError('Ingresa al menos una medición'); return;
    }
    setGuardando(true); setError('');
    const res = await fetch('/api/os/salud/cuerpo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: form.fecha, peso_kg: form.peso_kg || null, grasa_pct: form.grasa_pct || null,
        musculo_kg: form.musculo_kg || null, agua_pct: form.agua_pct || null,
        cintura_cm: form.cintura_cm || null, sueno_horas: form.sueno_horas || null,
      }),
    });
    const data = await res.json();
    setGuardando(false);
    if (data.error) { setError(data.error); return; }
    setForm({ fecha: hoyISO(), peso_kg: '', grasa_pct: '', musculo_kg: '', agua_pct: '', cintura_cm: '', sueno_horas: '' });
    cargar();
  }

  async function borrar(id: string) {
    if (!(await confirm({
      title: 'Borrar medicion',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Borrar',
      danger: true,
    }))) return;
    await fetch(`/api/os/salud/cuerpo?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  const pesoSeries = useMemo(() => {
    const orden = [...mediciones].filter((m) => m.peso_kg != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const crudo = orden.map((m) => ({ x: m.fecha, y: Number(m.peso_kg) }));
    return { crudo, media: promedioMovil(crudo, 7) };
  }, [mediciones]);

  const ultimo = mediciones[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}

      {/* Último registro */}
      {ultimo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8 }}>
          {[
            { label: 'Peso', val: ultimo.peso_kg, u: 'kg' },
            { label: 'Grasa', val: ultimo.grasa_pct, u: '%' },
            { label: 'Músculo', val: ultimo.musculo_kg, u: 'kg' },
            { label: 'Cintura', val: ultimo.cintura_cm, u: 'cm' },
          ].filter((m) => m.val != null).map((m) => (
            <div key={m.label} style={{ ...card, padding: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
              <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--os-champagne)', margin: '3px 0 0' }}>{m.val}<span style={{ fontSize: 11, color: 'var(--os-muted)' }}> {m.u}</span></p>
            </div>
          ))}
        </div>
      )}

      {/* Gráfica de peso */}
      <div style={card}>
        <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 12px' }}>
          Peso · tendencia (media móvil 7d)
        </p>
        <LineChart crudo={pesoSeries.crudo} media={pesoSeries.media} />
      </div>

      {/* Alta manual */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0 }}>Nueva medición</p>
        <input style={{ ...input, background: 'var(--os-surface)' }} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <input style={input} type="number" placeholder="Peso (kg)" value={form.peso_kg} onChange={(e) => setForm({ ...form, peso_kg: e.target.value })} />
          <input style={input} type="number" placeholder="Grasa (%)" value={form.grasa_pct} onChange={(e) => setForm({ ...form, grasa_pct: e.target.value })} />
          <input style={input} type="number" placeholder="Músculo (kg)" value={form.musculo_kg} onChange={(e) => setForm({ ...form, musculo_kg: e.target.value })} />
          <input style={input} type="number" placeholder="Agua (%)" value={form.agua_pct} onChange={(e) => setForm({ ...form, agua_pct: e.target.value })} />
          <input style={input} type="number" placeholder="Cintura (cm)" value={form.cintura_cm} onChange={(e) => setForm({ ...form, cintura_cm: e.target.value })} />
          <input style={input} type="number" placeholder="Sueño (h)" value={form.sueno_horas} onChange={(e) => setForm({ ...form, sueno_horas: e.target.value })} />
        </div>
        <Button disabled={guardando} onClick={guardar}>{guardando ? 'Guardando...' : 'Guardar medición'}</Button>
      </div>

      {/* Historial */}
      <div style={card}>
        <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 10px' }}>Historial</p>
        {loading ? <Spinner /> :
          !mediciones.length ? <EmptyState icon="monitor_weight" title="Sin mediciones aún" text="Guarda la primera con el formulario de arriba." /> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mediciones.slice(0, 30).map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
                <div>
                  <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', fontFamily: 'var(--os-font-mono)' }}>{m.fecha}</span>
                  <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', marginLeft: 8 }}>
                    {[m.peso_kg && `${m.peso_kg}kg`, m.grasa_pct && `${m.grasa_pct}%`, m.cintura_cm && `${m.cintura_cm}cm`, m.source !== 'manual' && m.source].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <Button variant="danger" size="sm" onClick={() => borrar(m.id)} aria-label="Borrar medición">✕</Button>
              </div>
            ))}
          </div>
        }
      </div>
      {sheet}
    </div>
  );
}
