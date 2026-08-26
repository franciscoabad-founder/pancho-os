import { useEffect, useState } from 'react';

interface Nodo { id: string; etiqueta: string; tipo: string; meta?: string }
interface Arista { desde: string; hacia: string; tipo: string }
const color: Record<string, string> = { proyecto: 'var(--os-accent-light)', tarea: 'var(--os-text)', journal: 'var(--os-champagne)', persona: 'var(--os-ok)', plan: 'var(--os-warn)' };

export default function OSConexiones() {
  const [data, setData] = useState<{ nodos: Nodo[]; aristas: Arista[]; meta: { nodos: number; conexiones: number } } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/conexiones').then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setData(body); }).catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar')); }, []);
  if (error) return <p role="alert">No se pudieron cargar conexiones: {error}</p>;
  if (!data) return <p className="os-muted">Cargando conexiones…</p>;
  const porTipo = data.nodos.reduce<Record<string, Nodo[]>>((grupos, nodo) => {
    (grupos[nodo.tipo] ??= []).push(nodo);
    return grupos;
  }, {});
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <section className="os-card"><p className="os-eyebrow">Grafo operativo</p><h1 className="os-h1" style={{ margin: 0 }}>Lo que ya está conectado</h1><p style={{ color: 'var(--os-muted)' }}>{data.meta.nodos} nodos · {data.meta.conexiones} relaciones estructuradas. No infiere vínculos desde texto libre.</p></section>
    {Object.entries(porTipo).map(([tipo, nodos]) => <section key={tipo} className="os-card"><h2 style={{ color: color[tipo] ?? 'var(--os-text)', marginTop: 0, textTransform: 'capitalize' }}>{tipo}s</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{nodos.map((n) => <span key={n.id} className="os-tag" title={n.meta}>{n.etiqueta}{n.meta ? ` · ${n.meta}` : ''}</span>)}</div></section>)}
  </div>;
}
