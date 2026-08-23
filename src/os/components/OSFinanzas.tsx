// Vista Finanzas: cuentas, deudas, por cobrar, gastos y presupuestos.
//
// Port de la pagina src/pages/finanzas.astro, que no tenia componente: todo el
// UI era markup inline mas un <script is:inline> que pintaba cada lista con
// innerHTML y cableaba los formularios a mano. Aca eso pasa a estado de React y
// JSX. Se conservan las mismas llamadas a /api/cuentas, /api/deudas,
// /api/gastos, /api/presupuestos y /api/por-cobrar, y el mismo comportamiento
// visible: resumen, filtros de por cobrar y de gastos, barras de presupuesto.
//
// Igual que en el original (nota "fase 2a"), se mantienen a proposito los
// prompt() de edicion de saldo y limite y los confirm() de borrado: cambiarlos
// implica rehacer el flujo de edicion. Los errores de PATCH/DELETE siguen
// saliendo en la caja de error inline de arriba, no en alert().

import { useCallback, useEffect, useState } from 'react';

interface Cuenta { id: string; nombre: string; tipo?: string | null; saldo?: number | null; moneda?: string | null }
interface Deuda { id: string; acreedor: string; monto?: number | null; cuota?: number | null; fecha_limite?: string | null; estado?: string | null }
interface PorCobrar { id: string; cliente: string; proyecto?: string | null; monto?: number | null; moneda?: string | null; estado?: string | null; fecha_esperada?: string | null }
interface Gasto { id: string; fecha?: string | null; categoria?: string | null; descripcion?: string | null; monto?: number | null }
interface Presupuesto { id: string; categoria: string; limite_mensual?: number | null }

const PC_LABEL: Record<string, string> = {
  aplicando: 'Aplicando',
  esperando: 'Esperando',
  aprobado_sin_pagar: 'Aprobado sin pagar',
  cobrado: 'Cobrado',
};
const PC_COLOR: Record<string, string> = {
  aplicando: 'var(--os-muted)',
  esperando: 'var(--os-accent-light)',
  aprobado_sin_pagar: 'var(--os-warn)',
  cobrado: 'var(--os-champagne)',
};

function money(n: unknown, moneda?: string | null): string {
  const v = Number(n) || 0;
  return v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + (moneda ? ' ' + moneda : '');
}
const thisMonth = () => new Date().toISOString().slice(0, 7);
const fechaLarga = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

const cssFinanzas = `
  .os-form {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: flex-end;
    margin-bottom: 0.875rem;
    background: var(--os-surface-2);
    border: 1px solid var(--os-line-soft);
    border-radius: var(--os-r-card);
    padding: 0.875rem 1rem;
  }
  .os-form .os-input { font-size: var(--os-text-sm); padding: 0.45rem 0.65rem; }
  .os-date { color-scheme: light dark; }
  select.os-input { cursor: pointer; }
  .os-chip {
    min-height: var(--os-tap-min);
    padding: 4px 11px;
    font-family: var(--os-font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: var(--os-r-sm);
    border: 1px solid var(--os-line);
    background: transparent;
    color: var(--os-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .os-chip:hover { color: var(--os-text-2); border-color: var(--os-line-accent); }
  .os-chip-on {
    background: rgba(59, 78, 217, 0.20);
    color: var(--os-text);
    border-color: rgba(59, 78, 217, 0.5);
  }
  @media (pointer: coarse) {
    .os-chip { min-height: var(--os-tap-coarse); }
  }
  @media (max-width: 820px) {
    .os-finance-summary { grid-template-columns: 1fr 1fr !important; }
    .os-form { gap: 7px; }
    .os-form .os-input { flex: 1 1 auto !important; min-width: 0 !important; }
    .os-form .os-btn { flex: 1 1 100%; justify-content: center; }
  }
`;

const filaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'var(--os-glass-bg)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--os-line)',
  borderRadius: 12,
  padding: '0.6rem 0.875rem',
};

const vacioStyle: React.CSSProperties = {
  color: 'var(--os-muted)',
  fontSize: 'var(--os-text-sm)',
  padding: '0.5rem 0',
};

function IconChip({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(59,78,217,0.14)', color: color || 'var(--os-accent-light)',
      }}
    >
      {name}
    </span>
  );
}

function BotonBorrar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Eliminar"
      className="material-symbols-outlined"
      style={{
        background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer',
        fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 'var(--os-tap-min)', minHeight: 'var(--os-tap-min)',
      }}
    >
      close
    </button>
  );
}

function Deadline({ fecha }: { fecha: string }) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <span style={{ fontSize: 11, color: fecha < hoy ? 'var(--os-error)' : 'var(--os-muted)' }}>
      {fechaLarga(fecha)}
    </span>
  );
}

/** Formulario de alta generico: replica wireForm() del script original. */
function FormularioApi({
  tabla,
  onCreado,
  children,
  etiquetaBoton,
}: {
  tabla: string;
  onCreado: () => Promise<void>;
  children: React.ReactNode;
  etiquetaBoton: string;
}) {
  const [msg, setMsg] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => { body[k] = v; });
    try {
      const res = await fetch('/api/' + tabla, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const jsonR = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(jsonR.error || String(res.status));
      form.reset();
      await onCreado();
    } catch (err) {
      setMsg('Error: ' + (err instanceof Error ? err.message : 'error desconocido'));
    }
  }

  return (
    <form onSubmit={enviar} className="os-form">
      {children}
      <button type="submit" className="os-btn">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        {etiquetaBoton}
      </button>
      {msg && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-error)', width: '100%', margin: 0 }}>{msg}</p>}
    </form>
  );
}

export default function OSFinanzas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [porCobrar, setPorCobrar] = useState<PorCobrar[]>([]);
  const [finError, setFinError] = useState('');
  const [errorCarga, setErrorCarga] = useState('');
  const [pcFilter, setPcFilter] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroCat, setFiltroCat] = useState('');

  const cargarTodo = useCallback(async () => {
    try {
      const [c, d, g, p, pc] = await Promise.all([
        fetch('/api/cuentas').then((r) => r.json()),
        fetch('/api/deudas').then((r) => r.json()),
        fetch('/api/gastos').then((r) => r.json()),
        fetch('/api/presupuestos').then((r) => r.json()),
        fetch('/api/por-cobrar').then((r) => r.json()),
      ]);
      setCuentas(c.cuentas || []);
      setDeudas(d.deudas || []);
      setGastos(g.gastos || []);
      setPresupuestos(p.presupuestos || []);
      setPorCobrar(pc.por_cobrar || []);
      setErrorCarga('');
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'error desconocido');
    }
  }, []);

  useEffect(() => { void cargarTodo(); }, [cargarTodo]);

  const patch = useCallback(async (tabla: string, id: string, body: unknown) => {
    try {
      const res = await fetch('/api/' + tabla + '?id=' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      setFinError('');
      await cargarTodo();
    } catch (e) {
      setFinError('Error al guardar: ' + (e instanceof Error ? e.message : 'error desconocido'));
    }
  }, [cargarTodo]);

  const del = useCallback(async (tabla: string, id: string) => {
    try {
      const res = await fetch('/api/' + tabla + '?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      setFinError('');
      await cargarTodo();
    } catch (e) {
      setFinError('Error al eliminar: ' + (e instanceof Error ? e.message : 'error desconocido'));
    }
  }, [cargarTodo]);

  // ---- Resumen ----
  const totCuentas = cuentas.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
  const totDeudas = deudas.reduce((s, d) => (d.estado === 'pagada' ? s : s + (Number(d.monto) || 0)), 0);
  const monedaBase = cuentas[0] ? cuentas[0].moneda : 'MXN';
  const pcNoCobrado = porCobrar.filter((p) => p.estado !== 'cobrado');
  const totPC = pcNoCobrado.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const monedaPC = pcNoCobrado[0] ? pcNoCobrado[0].moneda : (porCobrar[0] ? porCobrar[0].moneda : 'USD');
  const neto = money(totCuentas - totDeudas, monedaBase);

  // ---- Por cobrar ----
  const pcFilas = porCobrar.filter((p) => pcFilter === 'todos' || p.estado === pcFilter);
  const pcFilasNoCobrado = pcFilas.filter((p) => p.estado !== 'cobrado');
  const pcTotal = pcFilasNoCobrado.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const pcMoneda = pcFilasNoCobrado[0] ? pcFilasNoCobrado[0].moneda : 'USD';

  // ---- Gastos ----
  const categorias = Array.from(new Set(gastos.map((g) => g.categoria).filter(Boolean) as string[])).sort();
  const gastosFiltrados = gastos.filter((g) => {
    if (filtroMes && (g.fecha || '').slice(0, 7) !== filtroMes) return false;
    if (filtroCat && g.categoria !== filtroCat) return false;
    return true;
  });
  const totalGastos = gastosFiltrados.reduce((s, g) => s + (Number(g.monto) || 0), 0);

  const gastadoEsteMes = (categoria: string) => {
    const mes = thisMonth();
    return gastos.reduce(
      (s, g) => (g.categoria === categoria && (g.fecha || '').slice(0, 7) === mes ? s + (Number(g.monto) || 0) : s),
      0,
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssFinanzas }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Money</p>
          <h1 className="os-h1">Finanzas</h1>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: '4px 0 0' }}>
            Linea base manual de cuentas, deudas y gastos
          </p>
        </div>
      </div>

      {/* Error inline */}
      {finError && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--os-fill-subtle)', border: '1px solid var(--os-error)', borderRadius: 'var(--os-r-sm)', padding: '0.6rem 0.875rem', marginBottom: '1rem', fontSize: 'var(--os-text-sm)', color: 'var(--os-error)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          <span style={{ flex: 1 }}>{finError}</span>
          <button
            type="button"
            onClick={() => setFinError('')}
            aria-label="Cerrar"
            className="material-symbols-outlined"
            style={{ background: 'none', border: 'none', color: 'var(--os-error)', cursor: 'pointer', padding: 0, minWidth: 'var(--os-tap-min)', minHeight: 'var(--os-tap-min)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            close
          </button>
        </div>
      )}

      {/* Hero: Neto */}
      <div className="os-domino" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 30, color: 'var(--os-accent-light)' }}>account_balance_wallet</span>
          <div>
            <p className="os-eyebrow" style={{ marginBottom: 4 }}>Patrimonio neto</p>
            <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>Cuentas menos deudas activas</p>
          </div>
        </div>
        <span className="os-mono" style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--os-champagne)', lineHeight: 1, whiteSpace: 'nowrap' }}>
          {neto}
        </span>
      </div>

      {/* Resumen KPIs */}
      <div className="os-finance-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.75rem' }}>
        <div className="os-kpi">
          <p className="os-kpi-label">Total en cuentas</p>
          <p className="os-kpi-value">{money(totCuentas, monedaBase)}</p>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Total deudas</p>
          <p className="os-kpi-value">{money(totDeudas, monedaBase)}</p>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Por cobrar</p>
          <p className="os-kpi-value">{money(totPC, monedaPC)}</p>
        </div>
        <div className="os-kpi" style={{ borderColor: 'var(--os-line-accent)' }}>
          <p className="os-kpi-label" style={{ color: 'var(--os-accent-light)' }}>Neto</p>
          <p className="os-kpi-value" aria-hidden="true">{neto}</p>
        </div>
      </div>

      {/* ============ CUENTAS ============ */}
      <section style={{ marginBottom: '2rem' }}>
        <p className="os-section-title">Cuentas — mi linea base</p>
        <FormularioApi tabla="cuentas" onCreado={cargarTodo} etiquetaBoton="Cuenta">
          <input name="nombre" type="text" placeholder="Nombre (ej. Tampico) *" required className="os-input" style={{ flex: 2, minWidth: 160 }} />
          <input name="tipo" type="text" placeholder="Tipo (banco, efectivo...)" className="os-input" style={{ flex: 1, minWidth: 120 }} />
          <input name="saldo" type="number" step="any" placeholder="Saldo" className="os-input os-mono" style={{ width: 110 }} />
          <input name="moneda" type="text" placeholder="MXN" maxLength={6} className="os-input" style={{ width: 70 }} />
        </FormularioApi>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {errorCarga && (
            <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)', padding: '1rem' }}>
              Error cargando datos: {errorCarga}
            </div>
          )}
          {!errorCarga && !cuentas.length && <div style={vacioStyle}>Sin cuentas aun.</div>}
          {!errorCarga && cuentas.map((c) => (
            <div key={c.id} style={filaStyle}>
              <IconChip name="savings" color="var(--os-accent-light)" />
              <p style={{ fontSize: 13, color: 'var(--os-text)', margin: 0, flex: 1, minWidth: 0 }}>
                {c.nombre}
                {c.tipo && <span style={{ color: 'var(--os-muted)', fontSize: 11 }}> · {c.tipo}</span>}
              </p>
              <button
                type="button"
                onClick={() => {
                  const val = prompt('Nuevo saldo:', String(Number(c.saldo) || 0));
                  if (val === null) return;
                  void patch('cuentas', c.id, { saldo: Number(val) || 0 });
                }}
                style={{ fontSize: 'var(--os-text-sm)', minHeight: 'var(--os-tap-min)', color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {money(c.saldo, c.moneda)}
              </button>
              <BotonBorrar onClick={() => { if (confirm('Eliminar esta cuenta?')) void del('cuentas', c.id); }} />
            </div>
          ))}
        </div>
      </section>

      {/* ============ DEUDAS ============ */}
      <section style={{ marginBottom: '2rem' }}>
        <p className="os-section-title">Deudas</p>
        <FormularioApi tabla="deudas" onCreado={cargarTodo} etiquetaBoton="Deuda">
          <input name="acreedor" type="text" placeholder="Acreedor *" required className="os-input" style={{ flex: 2, minWidth: 150 }} />
          <input name="monto" type="number" step="any" placeholder="Monto" className="os-input os-mono" style={{ width: 110 }} />
          <input name="cuota" type="number" step="any" placeholder="Cuota" className="os-input os-mono" style={{ width: 100 }} />
          <input name="fecha_limite" type="date" className="os-input os-date" />
        </FormularioApi>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!deudas.length && <div style={vacioStyle}>Sin deudas registradas.</div>}
          {deudas.map((d) => {
            const pagada = d.estado === 'pagada';
            return (
              <div key={d.id} style={{ ...filaStyle, opacity: pagada ? 0.55 : 1 }}>
                <IconChip name={pagada ? 'check_circle' : 'south_west'} color={pagada ? 'var(--os-champagne)' : 'var(--os-warn)'} />
                <p style={{ fontSize: 13, color: 'var(--os-text)', margin: 0, flex: 1, minWidth: 0, textDecoration: pagada ? 'line-through' : 'none' }}>
                  {d.acreedor}
                </p>
                {Boolean(d.cuota) && <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>cuota {money(d.cuota)}</span>}
                {d.fecha_limite && <Deadline fecha={d.fecha_limite} />}
                <span style={{ fontSize: 13, color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>{money(d.monto)}</span>
                <button
                  type="button"
                  onClick={() => void patch('deudas', d.id, { estado: pagada ? 'activa' : 'pagada' })}
                  title="Marcar pagada/activa"
                  style={{ fontSize: 11, minHeight: 'var(--os-tap-min)', color: pagada ? 'var(--os-champagne)' : 'var(--os-muted)', background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--os-font-display)', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {pagada ? 'pagada' : 'activa'}
                </button>
                <BotonBorrar onClick={() => { if (confirm('Eliminar esta deuda?')) void del('deudas', d.id); }} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ POR COBRAR ============ */}
      <section style={{ marginBottom: '2rem' }}>
        <p className="os-section-title">Por cobrar — dinero por entrar</p>
        <FormularioApi tabla="por-cobrar" onCreado={cargarTodo} etiquetaBoton="Por cobrar">
          <input name="cliente" type="text" placeholder="Cliente *" required className="os-input" style={{ flex: 2, minWidth: 150 }} />
          <input name="proyecto" type="text" placeholder="Proyecto" className="os-input" style={{ flex: 1, minWidth: 120 }} />
          <input name="monto" type="number" step="any" placeholder="Monto" className="os-input os-mono" style={{ width: 110 }} />
          <input name="moneda" type="text" placeholder="USD" maxLength={6} className="os-input" style={{ width: 70 }} />
          <select name="estado" className="os-input os-date" defaultValue="aplicando">
            <option value="aplicando">Aplicando</option>
            <option value="esperando">Esperando respuesta</option>
            <option value="aprobado_sin_pagar">Aprobado sin pagar</option>
            <option value="cobrado">Cobrado</option>
          </select>
          <input name="fecha_esperada" type="date" className="os-input os-date" />
        </FormularioApi>

        {/* Filtros por estado */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--os-muted)' }}>filter_list</span>
            {(['todos', 'aplicando', 'esperando', 'aprobado_sin_pagar', 'cobrado'] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setPcFilter(e)}
                className={`os-chip${pcFilter === e ? ' os-chip-on' : ''}`}
              >
                {e === 'todos' ? 'Todos' : PC_LABEL[e]}
              </button>
            ))}
          </div>
          <span className="os-mono" style={{ fontSize: 12, color: 'var(--os-champagne)', fontWeight: 700, marginLeft: 'auto' }}>
            {pcFilasNoCobrado.length ? 'Por entrar: ' + money(pcTotal, pcMoneda) : ''}
          </span>
        </div>

        <div className="os-card" style={{ padding: '0.25rem 1rem' }}>
          {!pcFilas.length && (
            <div style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)', padding: '0.75rem 0' }}>
              Sin registros con este filtro.
            </div>
          )}
          {pcFilas.map((p, idx) => {
            const color = PC_COLOR[p.estado ?? ''] || 'var(--os-muted)';
            const cobrado = p.estado === 'cobrado';
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '0.7rem 0',
                  borderBottom: idx < pcFilas.length - 1 ? '1px solid var(--os-line-soft)' : undefined,
                  opacity: cobrado ? 0.6 : 1,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: 'var(--os-text)', margin: 0, lineHeight: 1.35 }}>
                    {p.cliente}
                    {p.proyecto && <span style={{ color: 'var(--os-muted)', fontSize: 11 }}> · {p.proyecto}</span>}
                  </p>
                  {p.fecha_esperada && (
                    <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '2px 0 0' }}>
                      Esperada: {fechaLarga(p.fecha_esperada)}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 14, color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {money(p.monto, p.moneda)}
                </span>
                <select
                  value={p.estado ?? 'aplicando'}
                  onChange={(e) => void patch('por-cobrar', p.id, { estado: e.target.value })}
                  style={{ background: 'var(--os-surface)', border: '1px solid var(--os-line)', borderRadius: 6, padding: '3px 7px', minHeight: 'var(--os-tap-min)', fontSize: 11, fontFamily: 'var(--os-font-display)', fontWeight: 600, color, cursor: 'pointer', outline: 'none' }}
                >
                  {Object.keys(PC_LABEL).map((e) => <option key={e} value={e}>{PC_LABEL[e]}</option>)}
                </select>
                <BotonBorrar onClick={() => { if (confirm('Eliminar este registro?')) void del('por-cobrar', p.id); }} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ GASTOS ============ */}
      <section style={{ marginBottom: '2rem' }}>
        <p className="os-section-title">Gastos</p>
        <FormularioApi tabla="gastos" onCreado={cargarTodo} etiquetaBoton="Gasto">
          <input name="fecha" type="date" className="os-input os-date" />
          <input name="categoria" type="text" placeholder="Categoria" className="os-input" style={{ flex: 1, minWidth: 120 }} />
          <input name="descripcion" type="text" placeholder="Descripcion" className="os-input" style={{ flex: 2, minWidth: 160 }} />
          <input name="monto" type="number" step="any" placeholder="Monto" className="os-input os-mono" style={{ width: 110 }} />
        </FormularioApi>

        {/* Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span className="os-kpi-label" style={{ margin: 0 }}>Mes</span>
            <input type="month" className="os-input os-date" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
            <button type="button" className="os-chip" onClick={() => setFiltroMes('')}>Todos</button>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1, minWidth: 140 }}>
            <span className="os-kpi-label" style={{ margin: 0 }}>Categoria</span>
            <select className="os-input os-date" style={{ flex: 1 }} value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <span className="os-mono" style={{ fontSize: 12, color: 'var(--os-champagne)', fontWeight: 700, marginLeft: 'auto' }}>
            {gastosFiltrados.length ? `${gastosFiltrados.length} gastos · ${money(totalGastos)}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!gastosFiltrados.length && <div style={vacioStyle}>Sin gastos con estos filtros.</div>}
          {gastosFiltrados.map((g) => (
            <div key={g.id} style={{ ...filaStyle, padding: '0.55rem 0.875rem' }}>
              <IconChip name="payments" color="var(--os-accent-light)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'var(--os-text)', margin: 0, lineHeight: 1.3 }}>{g.descripcion || ''}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>
                    {g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                  {g.categoria && (
                    <span style={{ fontSize: 11, color: 'var(--os-accent-light)', background: 'rgba(107,122,232,0.12)', padding: '1px 7px', borderRadius: 4 }}>
                      {g.categoria}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--os-text)', fontFamily: 'var(--os-font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                -{money(g.monto)}
              </span>
              <BotonBorrar onClick={() => { if (confirm('Eliminar este gasto?')) void del('gastos', g.id); }} />
            </div>
          ))}
        </div>
      </section>

      {/* ============ PRESUPUESTOS ============ */}
      <section style={{ marginBottom: '2rem' }}>
        <p className="os-section-title">Presupuestos — limite mensual por categoria</p>
        <FormularioApi tabla="presupuestos" onCreado={cargarTodo} etiquetaBoton="Presupuesto">
          <input name="categoria" type="text" placeholder="Categoria *" required className="os-input" style={{ flex: 2, minWidth: 160 }} />
          <input name="limite_mensual" type="number" step="any" placeholder="Limite mensual" className="os-input os-mono" style={{ width: 140 }} />
        </FormularioApi>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!presupuestos.length && <div style={vacioStyle}>Sin presupuestos definidos.</div>}
          {presupuestos.map((p) => {
            const limite = Number(p.limite_mensual) || 0;
            const usado = gastadoEsteMes(p.categoria);
            const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
            const over = limite > 0 && usado > limite;
            const barColor = over ? 'var(--os-error)' : (pct > 80 ? 'var(--os-warn)' : 'var(--os-accent)');
            return (
              <div key={p.id} style={{ background: 'var(--os-surface)', border: '1px solid var(--os-line)', borderRadius: 12, padding: '0.8rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--os-text)', margin: 0, flex: 1, fontWeight: 500 }}>{p.categoria}</p>
                  <span style={{ fontSize: 12, color: over ? 'var(--os-error)' : 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>
                    {money(usado)} / {money(limite)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = prompt('Nuevo limite mensual:', String(limite));
                      if (val === null) return;
                      void patch('presupuestos', p.id, { limite_mensual: Number(val) || 0 });
                    }}
                    style={{ fontSize: 11, minHeight: 'var(--os-tap-min)', color: 'var(--os-muted)', background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--os-font-display)', fontWeight: 600 }}
                  >
                    editar
                  </button>
                  <BotonBorrar onClick={() => { if (confirm('Eliminar este presupuesto?')) void del('presupuestos', p.id); }} />
                </div>
                <div style={{ height: 6, background: 'var(--os-surface-hi)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width .3s' }} />
                </div>
                {over && (
                  <p style={{ fontSize: 11, color: 'var(--os-error)', margin: '6px 0 0' }}>
                    Excedido por {money(usado - limite)} este mes
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
