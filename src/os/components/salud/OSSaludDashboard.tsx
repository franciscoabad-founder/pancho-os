import { useEffect, useState } from 'react';
import { duracionHoras, faseActual, formatearDuracion } from '../../../lib/salud/ayuno';
import OSNativeHealthConnect from './OSNativeHealthConnect';

const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};

const submodulos = [
  { href: '/salud/nutricion', label: 'Nutrición', icon: 'nutrition', desc: 'Macros y comidas' },
  { href: '/salud/ayuno', label: 'Ayuno', icon: 'timer', desc: 'Timer y fases' },
  { href: '/gfit', label: 'Entrenamiento', icon: 'fitness_center', desc: 'GFIT: rutinas y sesiones' },
  { href: '/salud/progreso', label: 'Progreso', icon: 'trending_up', desc: 'Fuerza y volumen' },
  { href: '/salud/cuerpo', label: 'Cuerpo', icon: 'monitor_weight', desc: 'Peso y medidas' },
  { href: '/salud/estiramiento', label: 'Estiramiento', icon: 'self_improvement', desc: 'Rutinas guiadas' },
];

export default function OSSaludDashboard() {
  const [macros, setMacros] = useState<{ kcal: number; proteina_g: number; carbos_g: number; grasa_g: number } | null>(null);
  const [ayuno, setAyuno] = useState<any>(null);
  const [nowMs, setNowMs] = useState(0);
  const [sesion, setSesion] = useState<any>(null);
  const [peso, setPeso] = useState<any>(null);
  const [sueno, setSueno] = useState<any>(null);
  const [dashboardError, setDashboardError] = useState(false);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    Promise.all([
      fetch('/api/salud/comidas-log').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ __error: true })),
      fetch('/api/salud/ayunos?abierto=1').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ __error: true })),
      fetch('/api/salud/sesiones?limit=1').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ __error: true })),
      fetch('/api/salud/cuerpo').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ __error: true })),
      fetch('/api/biometricas').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => ({ __error: true })),
    ]).then(([m, a, s, c, b]) => {
      setDashboardError([m, a, s, c, b].some((x) => x?.__error));
      if (m?.totales) setMacros(m.totales);
      if (a?.ayuno) setAyuno(a.ayuno);
      if (s?.sesiones?.length) setSesion(s.sesiones[0]);
      if (c?.mediciones?.length) setPeso(c.mediciones[0]);
      const ultimoSueno = b?.biometricas?.find((fila: { sueno_min?: number | null }) => fila.sueno_min != null);
      if (ultimoSueno) setSueno(ultimoSueno);
    });
    return () => clearInterval(t);
  }, []);

  const horasAyuno = ayuno && nowMs ? duracionHoras(ayuno.inicio, null, nowMs) : 0;

  return (
    <div className="salud-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="salud-hero" aria-labelledby="salud-hero-title">
        <div>
          <p className="salud-eyebrow">Panel de salud</p>
          <h1 id="salud-hero-title" className="salud-hero-title">Hoy, un dato a la vez.</h1>
          <p className="salud-hero-copy">Registra lo esencial y deja que tu ritmo marque el siguiente paso.</p>
        </div>
        <a className="salud-hero-action" href={ayuno ? '/salud/ayuno' : '/gfit'}>
          {ayuno ? 'Ver ayuno' : 'Empezar sesión'} <span aria-hidden="true">→</span>
        </a>
      </section>
      {dashboardError && <p role="status" style={{ margin: 0, color: 'var(--os-warn)', fontSize: 'var(--os-text-xs)' }}>Algunos datos no están disponibles ahora; los valores mostrados pueden estar incompletos.</p>}
      <OSNativeHealthConnect />
      {/* Resumen del día */}
      <div className="salud-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <a href="/salud/nutricion" style={{ ...card, textDecoration: 'none' }}>
          <p className="salud-kpi-label" style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Hoy · calorías</p>
          <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--os-text)', margin: '4px 0 0' }}>
            {macros ? Math.round(macros.kcal) : '—'}<span style={{ fontSize: 12, color: 'var(--os-muted)' }}> kcal</span>
          </p>
          {macros && <p style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)', margin: '2px 0 0' }}>P{Math.round(macros.proteina_g)} C{Math.round(macros.carbos_g)} G{Math.round(macros.grasa_g)}</p>}
        </a>

        <a href="/salud/ayuno" style={{ ...card, textDecoration: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Ayuno</p>
          {ayuno ? (
            <>
              <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--os-accent-light)', margin: '4px 0 0' }}>{formatearDuracion(horasAyuno)}</p>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{faseActual(horasAyuno).nombre}</p>
            </>
          ) : <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 16, color: 'var(--os-muted)', margin: '4px 0 0' }}>Sin ayuno</p>}
        </a>

        <a href="/gfit" style={{ ...card, textDecoration: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Última sesión</p>
          {sesion ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--os-text)', margin: '4px 0 0', textTransform: 'capitalize' }}>{sesion.tipo}</p>
              <p style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{sesion.fecha}</p>
            </>
          ) : <p style={{ fontSize: 14, color: 'var(--os-muted)', margin: '4px 0 0' }}>Ninguna</p>}
        </a>

        <a href="/salud/cuerpo" style={{ ...card, textDecoration: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Último peso</p>
          {peso?.peso_kg != null ? (
            <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--os-champagne)', margin: '4px 0 0' }}>{peso.peso_kg}<span style={{ fontSize: 12, color: 'var(--os-muted)' }}> kg</span></p>
          ) : <p style={{ fontSize: 14, color: 'var(--os-muted)', margin: '4px 0 0' }}>Sin registro</p>}
        </a>

        <a href="/salud/sueno" style={{ ...card, textDecoration: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Último sueño</p>
          {sueno?.sueno_min != null ? (
            <>
              <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--os-accent-light)', margin: '4px 0 0' }}>{Math.floor(sueno.sueno_min / 60)}h {sueno.sueno_min % 60}m</p>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>{sueno.fecha ?? 'Último registro'}</p>
            </>
          ) : <p style={{ fontSize: 14, color: 'var(--os-muted)', margin: '4px 0 0' }}>Sin registro</p>}
        </a>
      </div>

      {/* Navegación a submódulos */}
      <div className="salud-module-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {submodulos.map((s) => (
          <a key={s.href} href={s.href} className="os-card-interactive" style={{ ...card, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--os-accent-light)' }}>{s.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)' }}>{s.label}</span>
            <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{s.desc}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
