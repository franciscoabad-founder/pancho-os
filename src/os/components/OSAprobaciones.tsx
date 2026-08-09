import { useEffect, useState } from 'react';
import { EmptyState, Spinner } from './ui';

interface Aprobacion {
  id: string;
  titulo: string;
  tipo: string | null;
  contexto: string | null;
  opciones: unknown[];
  recomendacion: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'ejecutado';
  created_at?: string;
  updated_at?: string;
}

const labels: Record<string, string> = {
  approve: 'Aprobar',
  reject: 'Rechazar',
  execute: 'Ejecutar',
};

const ESTADO_POR_ACCION: Record<string, string> = {
  approve: 'aprobado',
  reject: 'rechazado',
  execute: 'ejecutado',
};

export default function OSAprobaciones() {
  const [items, setItems] = useState<Aprobacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/os/aprobaciones')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.aprobaciones)) {
          setItems(data.aprobaciones);
          setMessage('Listo.');
        } else {
          setMessage(data.error ?? 'No se pudo cargar aprobaciones.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(id: string, action: string) {
    setMessage(`${labels[action]}...`);
    try {
      const res = await fetch(`/api/os/aprobaciones?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: ESTADO_POR_ACCION[action] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      const actualizado: Aprobacion = data.aprobacion;
      setItems((prev) => prev.map((item) => (item.id === id ? actualizado : item)));
      setMessage('Actualizado.');
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const pendientes = items.filter((item) => item.estado === 'pendiente').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="os-kpi-grid">
        <div className="os-kpi">
          <p className="os-kpi-label">Pendientes</p>
          <p className="os-kpi-value">{pendientes}</p>
          <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Requieren decision</span>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Total</p>
          <p className="os-kpi-value">{items.length}</p>
          <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>En bandeja</span>
        </div>
      </div>

      {loading ? (
        <Spinner label="Cargando aprobaciones..." />
      ) : items.length === 0 ? (
        <div className="os-card-2">
          <EmptyState
            icon="approval_delegation"
            title="Nada por aprobar"
            text="Cuando Hermes o n8n necesiten una decision tuya, aparecera aqui."
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} className="os-card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span className="os-eyebrow">{item.tipo}</span>
                  <span className="os-tag">{item.estado}</span>
                </div>
                <h2 style={{ fontFamily: 'var(--os-font-display)', fontSize: 15, color: 'var(--os-text)', margin: '0 0 5px' }}>{item.titulo}</h2>
                <p style={{ color: 'var(--os-text-2)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{item.contexto}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="os-btn" type="button" disabled={item.estado !== 'pendiente'} onClick={() => act(item.id, 'approve')}>Aprobar</button>
                <button className="os-btn os-btn-ghost" type="button" disabled={item.estado !== 'pendiente'} onClick={() => act(item.id, 'execute')}>Ejecutar</button>
                <button className="os-btn os-btn-ghost" type="button" disabled={item.estado !== 'pendiente'} onClick={() => act(item.id, 'reject')}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ color: 'var(--os-muted)', fontSize: 12, margin: 0 }}>{message}</p>
    </div>
  );
}
