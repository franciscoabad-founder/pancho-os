import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, ToastProvider, useToast } from './ui';

interface Pendiente {
  id: string;
  titulo: string;
  detalle: string | null;
  proyecto: string | null;
  estado: 'abierto' | 'convertido' | 'descartado' | 'hecho';
  convertido_a: string | null;
  created_at: string;
}

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  abierto:    { label: 'Abierto',    color: 'var(--os-accent-light)', bg: 'rgba(107,122,232,0.14)' },
  convertido: { label: 'Convertido', color: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.12)' },
  descartado: { label: 'Descartado', color: 'var(--os-muted)', bg: 'rgba(107,114,128,0.14)' },
  hecho:      { label: 'Hecho',      color: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.12)' },
};

const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '7px 11px',
  minHeight: 36,
  fontSize: 'var(--os-text-sm)',
  color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)',
  outline: 'none',
  boxSizing: 'border-box',
};

const accionStyle: React.CSSProperties = {
  borderRadius: 6,
  cursor: 'pointer',
  padding: '3px 9px',
  minHeight: 36,
  fontSize: 'var(--os-text-xs)',
  fontFamily: 'var(--os-font-display)',
  fontWeight: 700,
  textTransform: 'uppercase',
};

function OSPendientesInner() {
  const toast = useToast();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [titulo, setTitulo] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mostrarCerrados, setMostrarCerrados] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/os/pendientes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setPendientes(data.pendientes ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/os/pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo.trim(), proyecto: proyecto.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setTitulo('');
      setProyecto('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function marcar(id: string, estado: Pendiente['estado']) {
    try {
      const res = await fetch(`/api/os/pendientes?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function convertirATarea(p: Pendiente) {
    const deadline = window.prompt('Deadline de la tarea (YYYY-MM-DD, vacio = sin deadline):', '');
    if (deadline === null) return;
    if (deadline.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      toast.show('Formato invalido. Usa YYYY-MM-DD', 'error');
      return;
    }
    try {
      const res = await fetch('/api/os/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: p.titulo,
          proyecto: p.proyecto,
          deadline: deadline.trim() || null,
          notas: p.detalle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      await fetch(`/api/os/pendientes?id=${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'convertido', convertido_a: 'tarea', convertido_id: data.tarea?.id ?? null }),
      });
      await load();
      toast.show('Convertido a tarea.', 'ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const visibles = pendientes.filter((p) => mostrarCerrados || p.estado === 'abierto');
  const abiertos = pendientes.filter((p) => p.estado === 'abierto').length;

  return (
    <div>
      <form onSubmit={agregar} className="os-card-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Que quieres hacer? *"
          required
          style={{ ...inputStyle, flex: 2, minWidth: 180 }}
        />
        <input
          value={proyecto}
          onChange={(e) => setProyecto(e.target.value)}
          placeholder="Proyecto"
          style={{ ...inputStyle, flex: 1, minWidth: 110 }}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Guardando...' : 'Agregar'}
        </Button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <p className="os-num" style={{ fontSize: 'var(--os-text-xs)', margin: 0 }}>{abiertos} abiertos</p>
        <Button size="sm" variant="ghost" onClick={() => setMostrarCerrados((v) => !v)}>
          {mostrarCerrados ? 'Ocultar cerrados' : 'Ver cerrados'}
        </Button>
      </div>

      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>Error: {error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && <Spinner />}
        {!loading && !visibles.length && (
          <div className="os-card-2">
            <EmptyState
              icon="pending_actions"
              title="Nada pendiente"
              text="Captura lo que quieras hacer sin comprometerte a una fecha. Cuando decidas actuar, conviertelo a tarea."
            />
          </div>
        )}
        {visibles.map((p) => {
          const meta = ESTADO_META[p.estado] ?? ESTADO_META.abierto;
          const cerrado = p.estado !== 'abierto';
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
              background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
              borderRadius: 10, padding: '0.625rem 0.875rem', opacity: cerrado ? 0.65 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: 0, lineHeight: 1.4, textDecoration: p.estado === 'hecho' ? 'line-through' : 'none' }}>
                  {p.titulo}
                </p>
                {p.proyecto && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-accent-light)', margin: '2px 0 0' }}>{p.proyecto}</p>}
              </div>
              <span style={{
                fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-display)', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: meta.color, background: meta.bg, borderRadius: 999, padding: '3px 10px',
              }}>
                {meta.label}
              </span>
              {!cerrado && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => convertirATarea(p)} title="Convertir a tarea"
                    style={{ ...accionStyle, background: 'rgba(59,78,217,0.16)', border: '1px solid rgba(59,78,217,0.4)', color: 'var(--os-accent-light)' }}>
                    Tarea
                  </button>
                  <button onClick={() => marcar(p.id, 'hecho')} title="Marcar hecho"
                    style={{ ...accionStyle, background: 'rgba(181,152,90,0.12)', border: '1px solid rgba(181,152,90,0.35)', color: 'var(--os-champagne)' }}>
                    Hecho
                  </button>
                  <button onClick={() => marcar(p.id, 'descartado')} title="Descartar"
                    style={{ ...accionStyle, background: 'none', border: '1px solid var(--os-line)', color: 'var(--os-muted)' }}>
                    Descartar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OSPendientes() {
  return (
    <ToastProvider>
      <OSPendientesInner />
    </ToastProvider>
  );
}
