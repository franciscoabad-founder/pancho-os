import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner, ToastProvider, useConfirm, useToast } from './ui';

// Vista KPIs: tablero en vivo desde /api/os/kpis.
// La tabla arranca vacia; el vacio invita a crear el primer KPI en vez de fingir datos.

interface KPI {
  id: string;
  label: string;
  unidad: string | null;
  meta: number | null;
  categoria: string | null;
  orden: number | null;
  fuente: string | null;
  activo: boolean;
  valor_actual: number | null;
  fecha_actual: string | null;
  tendencia: 'up' | 'down' | 'flat' | null;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '6px 10px',
  minHeight: 36,
  fontSize: 'var(--os-text-sm)',
  color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)',
  outline: 'none',
  boxSizing: 'border-box',
};

function formatearValor(valor: number | null, unidad: string | null): string {
  if (valor === null || valor === undefined) return '—';
  const u = (unidad || '').toLowerCase();
  if (u === '$' || u === 'usd' || u === 'dolares') {
    return '$' + valor.toLocaleString('es-EC', { maximumFractionDigits: 0 });
  }
  if (u === '%' || u === 'pct' || u === 'porcentaje') {
    return `${valor.toLocaleString('es-EC', { maximumFractionDigits: 1 })}%`;
  }
  const numero = valor.toLocaleString('es-EC', { maximumFractionDigits: 1 });
  return unidad ? `${numero} ${unidad}` : numero;
}

function TrendArrow({ t }: { t: KPI['tendencia'] }) {
  if (t === 'up') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--os-accent-light)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (t === 'down') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4537E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  return <span style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)', lineHeight: 1 }}>--</span>;
}

function OSKpisInner() {
  const toast = useToast();
  const { confirm, sheet } = useConfirm();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [registrando, setRegistrando] = useState<string | null>(null);
  const [valorNuevo, setValorNuevo] = useState('');

  const [creando, setCreando] = useState(false);
  const [nLabel, setNLabel] = useState('');
  const [nUnidad, setNUnidad] = useState('');
  const [nMeta, setNMeta] = useState('');
  const [nCategoria, setNCategoria] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/os/kpis', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setKpis(data.kpis ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function registrarValor(kpiId: string) {
    const num = Number(valorNuevo.replace(',', '.'));
    if (!Number.isFinite(num)) { toast.show('Ingresa un numero valido.', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/os/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi_id: kpiId, valor: num }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setRegistrando(null);
      setValorNuevo('');
      await load();
      toast.show('Valor registrado.', 'ok');
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function crearKpi(e: React.FormEvent) {
    e.preventDefault();
    if (!nLabel.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/os/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: nLabel.trim(),
          unidad: nUnidad.trim() || null,
          meta: nMeta.trim() ? Number(nMeta.trim()) : null,
          categoria: nCategoria.trim() || 'general',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setNLabel(''); setNUnidad(''); setNMeta(''); setNCategoria('');
      setCreando(false);
      await load();
      toast.show('KPI creado.', 'ok');
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(id: string) {
    if (!(await confirm({
      title: 'Eliminar KPI',
      text: 'Se elimina el KPI y todo su historial. Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    }))) return;
    try {
      const res = await fetch(`/api/os/kpis?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  if (loading) {
    return <Spinner label="Cargando KPIs..." />;
  }
  if (error && kpis.length === 0) {
    return (
      <div className="os-card-2" style={{ padding: '1rem' }}>
        <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)', margin: 0 }}>No se pudo cargar el tablero: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>{error}</p>}

      {kpis.length === 0 && !creando && (
        <div className="os-card-2">
          <EmptyState
            icon="monitoring"
            title="Todavia no hay KPIs"
            text="El tablero empieza vacio a proposito: nada de cifras inventadas."
            action={<Button size="sm" onClick={() => setCreando(true)}>Crear el primer KPI</Button>}
          />
        </div>
      )}

      {kpis.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <Button size="sm" variant={creando ? 'ghost' : 'primary'} onClick={() => setCreando((v) => !v)}>
            {creando ? 'Cancelar' : '+ Nuevo KPI'}
          </Button>
        </div>
      )}

      {creando && (
        <form onSubmit={crearKpi} className="os-card-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="Nombre del KPI *" required style={{ ...inputStyle, flex: 2, minWidth: 160 }} />
          <input value={nUnidad} onChange={(e) => setNUnidad(e.target.value)} placeholder="Unidad ($, %, personas...)" style={{ ...inputStyle, width: 150 }} />
          <input value={nMeta} onChange={(e) => setNMeta(e.target.value)} placeholder="Meta" type="number" style={{ ...inputStyle, width: 100 }} />
          <input value={nCategoria} onChange={(e) => setNCategoria(e.target.value)} placeholder="Categoria" style={{ ...inputStyle, width: 130 }} />
          <Button type="submit" size="sm" disabled={busy}>{busy ? '...' : 'Crear'}</Button>
        </form>
      )}

      {kpis.length > 0 && (
        <p className="os-section-title" style={{ marginTop: 0 }}>Todos los KPIs</p>
      )}
      <div className="os-kpi-grid">
        {kpis.map((k) => (
          <div key={k.id} className="os-kpi" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p className="os-kpi-label">{k.label}</p>
              <TrendArrow t={k.tendencia} />
            </div>
            <p className="os-kpi-value">{formatearValor(k.valor_actual, k.unidad)}</p>
            <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
              {k.meta !== null ? `meta ${formatearValor(k.meta, k.unidad)}` : 'sin meta'}
              {k.fecha_actual ? ` · ${k.fecha_actual}` : ''}
            </p>

            {registrando === k.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  autoFocus
                  value={valorNuevo}
                  onChange={(e) => setValorNuevo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') registrarValor(k.id); if (e.key === 'Escape') setRegistrando(null); }}
                  placeholder="Nuevo valor"
                  style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 'var(--os-text-xs)', padding: '4px 8px' }}
                />
                <Button size="sm" disabled={busy} onClick={() => registrarValor(k.id)}>OK</Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <button
                  className="os-btn-ghost"
                  style={{ borderRadius: 6, padding: '3px 9px', minHeight: 36, fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-display)', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => { setRegistrando(k.id); setValorNuevo(''); }}
                >
                  + registrar valor
                </button>
                <button
                  onClick={() => eliminar(k.id)}
                  title="Eliminar KPI"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', padding: 0, minHeight: 36, minWidth: 36, lineHeight: 1, marginLeft: 'auto' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {kpis.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <p className="os-section-title">Resumen por categoria</p>
          <div className="os-kpi-grid">
            {[...new Set(kpis.map((k) => k.categoria || 'general'))].map((cat) => {
              const total = kpis.filter((k) => (k.categoria || 'general') === cat).length;
              return (
                <div key={cat} className="os-kpi">
                  <p className="os-kpi-label">{cat}</p>
                  <p className="os-kpi-value">{total}</p>
                  <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>metricas seguidas</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {sheet}
    </div>
  );
}

export default function OSKpis() {
  return (
    <ToastProvider>
      <OSKpisInner />
    </ToastProvider>
  );
}
