import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner, EmptyState } from '../ui';
import { progressIndex, e1rmEpley, promedioMovil, type SetAnalytics } from '../../../lib/salud/progresion';

interface SetRow extends SetAnalytics { fecha: string }
interface CuerpoRow { fecha: string; peso_kg: number | null; sueno_horas: number | null }

const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};
const titulo: React.CSSProperties = {
  fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 12px',
};
const round = (n: number) => Math.round(n * 10) / 10;

// Semana ISO (yyyy-Www) de una fecha YYYY-MM-DD, para agrupar volumen.
function semanaDe(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

// ── Gráfica de líneas SVG (una o varias series) ──────────────────────────────
function LineChart({ series, height = 140, colores }: {
  series: { nombre: string; puntos: { x: string; y: number }[] }[]; height?: number; colores: string[];
}) {
  const todos = series.flatMap((s) => s.puntos);
  if (!todos.length) return <EmptyState icon="show_chart" title="Sin datos aún" text="Registra sesiones para ver esta gráfica." />;
  const xs = Array.from(new Set(todos.map((p) => p.x))).sort();
  const maxY = Math.max(...todos.map((p) => p.y), 1);
  const minY = Math.min(...todos.map((p) => p.y), 0);
  const W = 320, H = height, pad = 6;
  const xPos = (x: string) => pad + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * (W - pad * 2);
  const yPos = (y: number) => H - pad - ((y - minY) / Math.max(1, maxY - minY)) * (H - pad * 2);
  return (
    <div className="os-hscroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ minWidth: 280 }}>
        {series.map((s, i) => {
          const pts = [...s.puntos].sort((a, b) => (a.x < b.x ? -1 : 1));
          const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`).join(' ');
          return (
            <g key={s.nombre}>
              <path d={d} fill="none" stroke={colores[i % colores.length]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, j) => <circle key={j} cx={xPos(p.x)} cy={yPos(p.y)} r="2.5" fill={colores[i % colores.length]} />)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Gráfica de barras SVG ─────────────────────────────────────────────────────
function BarChart({ datos, color = 'var(--os-accent)' }: { datos: { label: string; valor: number }[]; color?: string }) {
  if (!datos.length) return <EmptyState icon="bar_chart" title="Sin datos aún" text="Registra sesiones para ver esta gráfica." />;
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {datos.map((d) => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)', width: 90, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
          <div style={{ flex: 1, height: 16, background: 'var(--os-fill-subtle)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.valor / max) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
          <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', width: 56, textAlign: 'right' }}>{Math.round(d.valor)}</span>
        </div>
      ))}
    </div>
  );
}

export default function OSSaludProgreso() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [cuerpo, setCuerpo] = useState<CuerpoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/os/salud/progreso')
      .then((r) => r.json())
      .then((d) => { setSets(d.sets ?? []); setCuerpo(d.cuerpo ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => progressIndex(sets), [sets]);

  // Volumen semanal (working sets).
  const volumenSemanal = useMemo(() => {
    const porSemana: Record<string, number> = {};
    for (const s of sets) {
      if (s.tipo_set === 'warmup') continue;
      const vol = (Number(s.reps) || 0) * (Number(s.peso_kg) || 0);
      const sem = semanaDe(s.fecha);
      porSemana[sem] = (porSemana[sem] || 0) + vol;
    }
    return Object.entries(porSemana).sort().slice(-8).map(([label, valor]) => ({ label: label.slice(5), valor: round(valor) }));
  }, [sets]);

  // e1RM por ejercicio a lo largo del tiempo (top 4 por número de sesiones).
  const e1rmSeries = useMemo(() => {
    const porEj: Record<string, { nombre: string; puntos: Record<string, number> }> = {};
    for (const s of sets) {
      if (s.tipo_set === 'warmup') continue;
      const e1rm = e1rmEpley(Number(s.peso_kg) || 0, Number(s.reps) || 0);
      if (e1rm <= 0) continue;
      const entry = (porEj[s.ejercicio_id] ??= { nombre: s.ejercicio_nombre, puntos: {} });
      entry.puntos[s.fecha] = Math.max(entry.puntos[s.fecha] || 0, e1rm);
    }
    return Object.values(porEj)
      .map((e) => ({ nombre: e.nombre, puntos: Object.entries(e.puntos).map(([x, y]) => ({ x, y })) }))
      .filter((e) => e.puntos.length >= 2)
      .sort((a, b) => b.puntos.length - a.puntos.length)
      .slice(0, 4);
  }, [sets]);

  // Peso corporal con promedio móvil de 7 días.
  const pesoSeries = useMemo(() => {
    const puntos = cuerpo.filter((c) => c.peso_kg != null).map((c) => ({ x: c.fecha, y: Number(c.peso_kg) }));
    const mm = promedioMovil(puntos, 7);
    return { crudo: puntos, media: mm };
  }, [cuerpo]);

  const grupos = useMemo(() =>
    Object.entries(analytics.volumenPorGrupo).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor),
  [analytics]);

  const COLORES = ['var(--os-accent-light)', 'var(--os-accent)', 'var(--os-champagne)', 'var(--os-bronze)'];

  if (loading) return <Spinner />;

  const sinDatos = !sets.length && !cuerpo.length;
  if (sinDatos) {
    return (
      <EmptyState
        icon="trending_up"
        title="Aún no hay datos"
        text="Registra sesiones de entrenamiento y mediciones corporales para ver tu progreso."
        action={<Button size="sm" onClick={() => { window.location.href = '/os/salud/entrenamiento'; }}>Ir a Entrenamiento</Button>}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Alertas de balance */}
      {analytics.alertas.length > 0 && (
        <div style={{ ...card, borderColor: 'color-mix(in srgb, var(--os-warn) 30%, transparent)', background: 'color-mix(in srgb, var(--os-warn) 8%, var(--os-surface-2))' }}>
          <p style={{ ...titulo, color: 'var(--os-warn)', margin: '0 0 8px' }}>Balance muscular</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {analytics.alertas.map((a, i) => <li key={i} style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)', marginBottom: 3 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Ratios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ ...titulo, margin: '0 0 6px' }}>Push / Pull</p>
          <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--os-champagne)', margin: 0 }}>
            {analytics.ratios.pushPull == null ? '—' : (analytics.ratios.pushPull === Infinity ? '∞' : analytics.ratios.pushPull)}
          </p>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ ...titulo, margin: '0 0 6px' }}>Squat / Hinge</p>
          <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--os-champagne)', margin: 0 }}>
            {analytics.ratios.squatHinge == null ? '—' : (analytics.ratios.squatHinge === Infinity ? '∞' : analytics.ratios.squatHinge)}
          </p>
        </div>
      </div>

      {/* e1RM por ejercicio */}
      <div style={card}>
        <p style={titulo}>Fuerza · e1RM estimado (Epley)</p>
        <LineChart series={e1rmSeries.map((e) => ({ nombre: e.nombre, puntos: e.puntos }))} colores={COLORES} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {e1rmSeries.map((e, i) => (
            <span key={e.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)' }}>
              <span style={{ width: 10, height: 3, background: COLORES[i % COLORES.length], borderRadius: 2 }} />{e.nombre}
            </span>
          ))}
        </div>
      </div>

      {/* Volumen semanal */}
      <div style={card}>
        <p style={titulo}>Volumen semanal (sets × reps × peso)</p>
        <BarChart datos={volumenSemanal} />
      </div>

      {/* Balance por grupo */}
      <div style={card}>
        <p style={titulo}>Volumen por grupo muscular</p>
        <BarChart datos={grupos} color="var(--os-accent-light)" />
      </div>

      {/* Peso corporal */}
      <div style={card}>
        <p style={titulo}>Peso corporal (crudo + media móvil 7d)</p>
        <LineChart series={[
          { nombre: 'Peso', puntos: pesoSeries.crudo },
          { nombre: 'Media 7d', puntos: pesoSeries.media },
        ]} colores={['rgba(107,122,232,0.4)', 'var(--os-champagne)']} />
      </div>
    </div>
  );
}
