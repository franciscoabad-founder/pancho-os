import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, useConfirm } from './ui';

interface Recordatorio {
  id: string;
  mensaje: string;
  recordar_at: string;
  canal: string;
  estado: 'pendiente' | 'enviado' | 'hecho' | 'cancelado';
  enviado_at: string | null;
  created_at: string;
}

const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--os-accent-light)', bg: 'rgba(107,122,232,0.14)' },
  enviado:   { label: 'Enviado',   color: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.14)' },
  hecho:     { label: 'Hecho',     color: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.12)' },
  cancelado: { label: 'Cancelado', color: 'var(--os-muted)', bg: 'rgba(107,114,128,0.14)' },
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

export default function OSRecordatorios() {
  const { confirm, sheet } = useConfirm();
  const [items, setItems] = useState<Recordatorio[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [cuando, setCuando] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/os/recordatorios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setItems(data.recordatorios ?? []);
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
    if (!mensaje.trim() || !cuando || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/os/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensaje.trim(), recordar_at: new Date(cuando).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setMensaje('');
      setCuando('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function marcar(id: string, estado: Recordatorio['estado']) {
    try {
      const res = await fetch(`/api/os/recordatorios?id=${encodeURIComponent(id)}`, {
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

  async function eliminar(id: string) {
    if (!(await confirm({
      title: 'Eliminar recordatorio',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    }))) return;
    try {
      const res = await fetch(`/api/os/recordatorios?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function fechaBonita(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  const activos = items.filter((r) => r.estado === 'pendiente' || r.estado === 'enviado');
  const cerrados = items.filter((r) => r.estado === 'hecho' || r.estado === 'cancelado');

  return (
    <div>
      <form onSubmit={agregar} className="os-card-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
        <input
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Que te recordamos? *"
          required
          style={{ ...inputStyle, flex: 2, minWidth: 180 }}
        />
        <input
          type="datetime-local"
          value={cuando}
          onChange={(e) => setCuando(e.target.value)}
          required
          style={{ ...inputStyle, minWidth: 190 }}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Guardando...' : 'Agregar'}
        </Button>
      </form>

      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>Error: {error}</p>}
      {loading && <Spinner />}

      {!loading && !items.length && (
        <div className="os-card-2">
          <EmptyState
            icon="notifications"
            title="Sin recordatorios"
            text="Hermes los empuja al celular cuando llega la hora. Crea el primero con el formulario de arriba."
          />
        </div>
      )}

      {[{ titulo: 'Activos', lista: activos }, { titulo: 'Historial', lista: cerrados }].map(({ titulo, lista }) => (
        lista.length > 0 && (
          <div key={titulo} style={{ marginBottom: '1.25rem' }}>
            <p className="os-section-title">{titulo}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lista.map((r) => {
                const meta = ESTADO_META[r.estado] ?? ESTADO_META.pendiente;
                const vencido = r.estado === 'pendiente' && new Date(r.recordar_at) < new Date();
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap',
                    background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
                    borderRadius: 10, padding: '0.625rem 0.875rem',
                    opacity: titulo === 'Historial' ? 0.65 : 1,
                  }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: 0, lineHeight: 1.4 }}>{r.mensaje}</p>
                      <p className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: vencido ? 'var(--os-error)' : 'var(--os-muted)', margin: '2px 0 0' }}>
                        {fechaBonita(r.recordar_at)}{vencido ? ' · vencido' : ''}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-display)', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: meta.color, background: meta.bg, borderRadius: 999, padding: '3px 10px',
                    }}>
                      {meta.label}
                    </span>
                    {(r.estado === 'pendiente' || r.estado === 'enviado') && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => marcar(r.id, 'hecho')}
                          style={{ ...accionStyle, background: 'rgba(181,152,90,0.12)', border: '1px solid rgba(181,152,90,0.35)', color: 'var(--os-champagne)' }}>
                          Hecho
                        </button>
                        <button onClick={() => marcar(r.id, 'cancelado')}
                          style={{ ...accionStyle, background: 'none', border: '1px solid var(--os-line)', color: 'var(--os-muted)' }}>
                          Cancelar
                        </button>
                      </div>
                    )}
                    <button onClick={() => eliminar(r.id)} title="Eliminar"
                      style={{ background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer', padding: 0, minWidth: 36, minHeight: 36, fontSize: 15, lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
      {sheet}
    </div>
  );
}
