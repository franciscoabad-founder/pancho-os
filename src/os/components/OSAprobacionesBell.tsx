import { useEffect, useState } from 'react';

type Aprobacion = {
  id: string;
  titulo: string;
  contexto: string | null;
  recomendacion: string | null;
  estado: string;
  expira_at?: string | null;
};

export default function OSAprobacionesBell() {
  const [items, setItems] = useState<Aprobacion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/aprobaciones?estado=pendiente', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.aprobaciones) ? data.aprobaciones : []);
      }
    } catch { /* la campana es informativa; no bloquea el shell */ }
  }

  useEffect(() => { void load(); }, []);

  async function decide(id: string, estado: 'aprobado' | 'rechazado') {
    setBusy(id);
    try {
      const res = await fetch(`/api/aprobaciones?id=${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, decidido_por: 'web-topbar' }),
      });
      if (res.ok) setItems((prev) => prev.filter((item) => item.id !== id));
    } finally { setBusy(null); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="os-theme-toggle" onClick={() => setOpen((v) => !v)} aria-label={`Aprobaciones pendientes: ${items.length}`} title="Aprobaciones pendientes">
        <span className="material-symbols-outlined">notifications</span>
        {items.length > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--os-accent)', color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && <div style={{ position: 'absolute', right: 0, top: 42, width: 320, maxWidth: 'calc(100vw - 2rem)', background: 'var(--os-bg-sunken)', border: '1px solid var(--os-line)', borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,.25)', padding: 10, zIndex: 200 }}>
        <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '2px 4px 8px' }}>Decisiones pendientes</p>
        {items.length === 0 ? <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 4 }}>No hay aprobaciones pendientes.</p> : items.map((item) => {
          const expirada = item.expira_at ? new Date(item.expira_at).getTime() <= Date.now() : false;
          return <div key={item.id} style={{ borderTop: '1px solid var(--os-line-soft)', padding: '9px 4px' }}>
            <p style={{ fontSize: 13, color: 'var(--os-text)', fontWeight: 600, margin: 0 }}>{item.titulo}</p>
            {(item.contexto || item.recomendacion) && <p style={{ fontSize: 11, color: 'var(--os-text-2)', margin: '4px 0' }}>{item.contexto || item.recomendacion}</p>}
            {expirada && <p style={{ fontSize: 11, color: 'var(--os-danger, #c44)', margin: '4px 0' }}>Expirada</p>}
            <div style={{ display: 'flex', gap: 5 }}><button type="button" className="os-btn" disabled={busy === item.id || expirada} onClick={() => void decide(item.id, 'aprobado')}>Aprobar</button><button type="button" className="os-btn os-btn-ghost" disabled={busy === item.id || expirada} onClick={() => void decide(item.id, 'rechazado')}>Rechazar</button></div>
          </div>;
        })}
        <a href="/aprobaciones" style={{ display: 'block', fontSize: 11, color: 'var(--os-accent-light)', margin: '8px 4px 2px' }}>Ver todas</a>
      </div>}
    </div>
  );
}
