// Campana de eventos que Hermes le empuja al OS (F4).
//
// Mismo patron que OSAprobacionesBell: informativa, nunca bloquea el shell, y
// un error de red se traga en silencio. La diferencia es que aca si hay poll
// (cada 30 s), porque el punto de F4 es enterarse de algo que paso del lado de
// Hermes sin que Pancho recargue la pagina.

import { useEffect, useState } from 'react';

type EventoHermes = {
  id: string;
  tipo: string;
  titulo: string | null;
  session_key: string | null;
  created_at: string;
};

const POLL_MS = 30_000;

function horaCorta(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function OSHermesBell() {
  const [items, setItems] = useState<EventoHermes[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    async function load() {
      try {
        const res = await fetch('/api/hermes/eventos?leido=false', { cache: 'no-store' });
        if (!res.ok || !vivo) return;
        const data = await res.json();
        setItems(Array.isArray(data.eventos) ? data.eventos : []);
      } catch { /* la campana es informativa; no bloquea el shell */ }
    }
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  async function marcar(id: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/hermes/eventos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setItems((prev) => prev.filter((item) => item.id !== id));
    } catch { /* si falla, el evento sigue sin leer y vuelve en el proximo poll */ }
    finally { setBusy(null); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="os-theme-toggle" onClick={() => setOpen((v) => !v)} aria-label={`Avisos de Hermes: ${items.length}`} title="Avisos de Hermes">
        <span className="material-symbols-outlined">smart_toy</span>
        {items.length > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--os-accent)', color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && <div style={{ position: 'absolute', right: 0, top: 42, width: 320, maxWidth: 'calc(100vw - 2rem)', background: 'var(--os-bg-sunken)', border: '1px solid var(--os-line)', borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,.25)', padding: 10, zIndex: 200 }}>
        <p style={{ fontSize: 11, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '2px 4px 8px' }}>Avisos de Hermes</p>
        {items.length === 0 ? <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 4 }}>Sin avisos nuevos.</p> : items.map((item) => (
          <div key={item.id} style={{ borderTop: '1px solid var(--os-line-soft)', padding: '9px 4px' }}>
            <p style={{ fontSize: 13, color: 'var(--os-text)', fontWeight: 600, margin: 0 }}>{item.titulo || item.tipo}</p>
            <p style={{ fontSize: 11, color: 'var(--os-text-2)', margin: '4px 0' }}>
              {item.tipo}{item.session_key ? ` · ${item.session_key}` : ''} · {horaCorta(item.created_at)}
            </p>
            <button type="button" className="os-btn os-btn-ghost" disabled={busy === item.id} onClick={() => void marcar(item.id)}>Marcar leido</button>
          </div>
        ))}
        <a href="/chat" style={{ display: 'block', fontSize: 11, color: 'var(--os-accent-light)', margin: '8px 4px 2px' }}>Ir al chat</a>
      </div>}
    </div>
  );
}
