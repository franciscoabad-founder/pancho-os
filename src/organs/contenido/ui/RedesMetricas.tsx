import { useEffect, useState } from 'react';

const PLATAFORMAS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'youtube', 'x'] as const;

const META: Record<string, { label: string; color: string; icon: string }> = {
  instagram: { label: 'Instagram', color: 'var(--os-accent-light)', icon: 'photo_camera' },
  facebook: { label: 'Facebook', color: 'var(--os-accent)', icon: 'thumb_up' },
  tiktok: { label: 'TikTok', color: 'var(--os-text)', icon: 'music_note' },
  linkedin: { label: 'LinkedIn', color: 'var(--os-accent)', icon: 'work' },
  youtube: { label: 'YouTube', color: 'var(--os-muted)', icon: 'smart_display' },
  x: { label: 'X', color: 'var(--os-text)', icon: 'tag' },
};

type Metrica = { seguidores?: number | null; alcance?: number | null; interacciones?: number | null };
type Punto = Metrica & { fecha: string };
type Plataforma = { actual: Metrica; serie: Punto[] };
type Post = { plataforma?: string; titulo?: string | null; url?: string | null; post_id?: string; likes?: number | null; comentarios?: number | null; compartidos?: number | null };
type Resumen = { plataformas: Record<string, Plataforma>; posts_top: Post[] };

const fmt = (n: unknown) => (Number(n) || 0).toLocaleString('es-EC');
const safeUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

function delta(serie: Punto[]) {
  if (serie.length < 2) return 0;
  return (Number(serie.at(-1)?.seguidores) || 0) - (Number(serie[Math.max(0, serie.length - 8)]?.seguidores) || 0);
}

function Sparkline({ serie }: { serie: Punto[] }) {
  if (serie.length < 2) return null;
  const values = serie.map((p) => Number(p.seguidores) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 220;
    const y = max === min ? 16 : 32 - ((value - min) / (max - min)) * 32;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return <svg viewBox="0 0 220 32" width="100%" height="32" preserveAspectRatio="none" aria-label="Evolución de seguidores"><polyline points={points} fill="none" stroke="var(--os-accent)" strokeWidth="1.5" /></svg>;
}

function RedCard({ red, info }: { red: string; info?: Plataforma }) {
  const meta = META[red];
  if (!info) return <article className="os-card-2" style={{ borderTop: '2px solid var(--os-line)', opacity: 0.6 }}><p className="os-kpi-label"><span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: 'middle' }}>{meta.icon}</span> {meta.label}</p><p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>Sin conectar</p></article>;
  const change = delta(info.serie);
  const changeColor = change > 0 ? 'var(--os-champagne)' : change < 0 ? '#D4537E' : 'var(--os-muted)';
  return <article className="os-card-2" style={{ borderTop: `2px solid ${meta.color}` }}>
    <p className="os-kpi-label" style={{ color: meta.color, marginBottom: 14 }}><span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: 'middle' }}>{meta.icon}</span> {meta.label}</p>
    <div style={{ display: 'flex', alignItems: 'end', gap: 8, marginBottom: 6 }}><p className="os-num" style={{ fontSize: '1.5rem', margin: 0 }}>{fmt(info.actual.seguidores)}</p><span style={{ color: changeColor, fontFamily: 'var(--os-font-mono)', fontSize: 11 }}>{change > 0 ? '+' : ''}{fmt(change)}</span></div>
    <p className="os-kpi-label" style={{ margin: '0 0 12px' }}>Seguidores · últimos 7 días</p>
    <Sparkline serie={info.serie} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid var(--os-line-soft)' }}><div><p className="os-kpi-label" style={{ margin: '0 0 3px' }}>Alcance</p><p className="os-num" style={{ fontSize: '1rem', margin: 0 }}>{fmt(info.actual.alcance)}</p></div><div><p className="os-kpi-label" style={{ margin: '0 0 3px' }}>Interacciones</p><p className="os-num" style={{ fontSize: '1rem', margin: 0 }}>{fmt(info.actual.interacciones)}</p></div></div>
  </article>;
}

export default function RedesMetricas() {
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch('/api/redes-metricas?dias=30').then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<Resumen>; }).then(setData).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las métricas')); }, []);
  const estado = !data && !error ? 'Cargando…' : data && Object.keys(data.plataformas).length ? 'En vivo' : 'Conectar APIs';
  return <section aria-labelledby="redes-metricas-title">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}><h2 id="redes-metricas-title" className="os-section-title" style={{ margin: 0 }}>Pulso de redes</h2><span className="os-pill os-tag" style={{ background: 'var(--os-fill-subtle)' }}>{estado}</span></div>
    {error ? <p style={{ color: 'var(--os-error)', fontSize: 12 }}>No se pudieron cargar las métricas: {error}</p> : <><div className="os-social-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10, marginBottom: '1.5rem' }}>{PLATAFORMAS.map((red) => <RedCard key={red} red={red} info={data?.plataformas[red]} />)}</div><div className="os-card-2" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}><p className="os-section-title" style={{ margin: '0 0 .875rem' }}>Top posts (30 días)</p>{!data ? <p style={{ color: 'var(--os-muted)', fontSize: 12, margin: 0 }}>Cargando…</p> : data.posts_top.length === 0 ? <p style={{ color: 'var(--os-muted)', fontSize: 12, margin: 0 }}>Sin posts registrados aún.</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{data.posts_top.map((post, index) => { const url = safeUrl(post.url); return <div key={`${post.plataforma}-${post.post_id ?? index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)', borderRadius: 'var(--os-r-card)', padding: '.6rem .8rem' }}><div style={{ minWidth: 0 }}><p className="os-kpi-label" style={{ margin: '0 0 3px' }}>{META[post.plataforma ?? '']?.label ?? post.plataforma}</p>{url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--os-text)', fontSize: 12 }}>{post.titulo || post.url}</a> : <p style={{ fontSize: 12, margin: 0 }}>{post.titulo || post.post_id || post.url}</p>}</div><span style={{ fontFamily: 'var(--os-font-mono)', color: 'var(--os-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmt((Number(post.likes) || 0) + (Number(post.comentarios) || 0) + (Number(post.compartidos) || 0))} interacciones</span></div>; })}</div>}</div></>}
  </section>;
}
