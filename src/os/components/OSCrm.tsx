// Vista CRM: pipeline de leads contra /api/leads.
//
// Port de la pagina src/pages/crm.astro, que no tenia componente: todo el UI
// vivia como markup inline mas un <script is:inline> que pintaba kanban y tabla
// con innerHTML. Aca eso pasa a estado de React y JSX; el comportamiento visible
// (vistas kanban/tabla, filtros por etapa, KPIs, alta rapida, borrado con
// confirm, FAB que enfoca el formulario) se conserva igual.
//
// Se mantiene el confirm() de borrado a proposito, igual que la nota "fase 2a"
// del original: cambiarlo implica rehacer el flujo. Los errores siguen saliendo
// en el mensaje inline debajo del formulario, no en alert().

import { useCallback, useEffect, useRef, useState } from 'react';
import { useProyectosActivos } from '../hooks/useProyectosActivos.ts';

const ETAPAS = ['nuevo', 'prospecto', 'contacto', 'propuesta', 'negociacion', 'cerrado'] as const;
type Etapa = (typeof ETAPAS)[number];

const ETAPA_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  prospecto: 'Prospecto',
  contacto: 'Contacto',
  propuesta: 'Propuesta',
  negociacion: 'Negociacion',
  cerrado: 'Cerrado',
};

// Colores de etapa con tokens duales: fg = texto/punto, bg = relleno del pill.
const ETAPA_COLOR: Record<string, { fg: string; bg: string }> = {
  nuevo: { fg: 'var(--os-muted)', bg: 'var(--os-fill-subtle)' },
  prospecto: { fg: 'var(--os-text-2)', bg: 'var(--os-fill-subtle)' },
  contacto: { fg: 'var(--os-accent-light)', bg: 'rgba(59,78,217,0.14)' },
  propuesta: { fg: 'var(--os-accent)', bg: 'rgba(59,78,217,0.14)' },
  negociacion: { fg: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.16)' },
  cerrado: { fg: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.16)' },
};
const ETAPA_COLOR_DEFAULT = { fg: 'var(--os-muted)', bg: 'var(--os-fill-subtle)' };

const VIEW_ON_BG = 'rgba(59,78,217,0.22)';

export interface Lead {
  id: string;
  nombre: string;
  empresa?: string | null;
  cargo?: string | null;
  producto?: string | null;
  proyecto?: string | null;
  ultimo_contacto?: string | null;
  proximo_contacto?: string | null;
  etapa?: string | null;
  probabilidad?: number | null;
  scoring?: number | null;
  valor?: number | null;
  etiquetas?: string[] | null;
  notas?: string | null;
}

function fmtValor(n: unknown): string {
  if (!n && n !== 0) return '';
  return '$' + Number(n).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const esPrioritario = (l: Lead) =>
  Boolean((l.scoring && l.scoring >= 70) || (l.probabilidad && l.probabilidad >= 70));

const cssCrm = `
  @media (max-width: 820px) {
    .os-crm-kpis { grid-template-columns: 1fr 1fr !important; }
  }
`;

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontFamily: 'var(--os-font-display)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--os-muted)',
  borderBottom: '1px solid var(--os-line)',
};

const inputStyle: React.CSSProperties = {
  fontSize: 'var(--os-text-sm)',
  padding: '6px 11px',
};

export default function OSCrm() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const proyectos = useProyectosActivos();
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [filtro, setFiltro] = useState<'todos' | Etapa>('todos');
  const [vista, setVista] = useState<'kanban' | 'tabla'>('kanban');
  const [msg, setMsg] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);

  const cargarLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { leads?: Lead[] };
      setLeads(data.leads ?? []);
      setErrorCarga('');
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'error desconocido');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargarLeads(); }, [cargarLeads]);

  const visibles = filtro === 'todos' ? leads : leads.filter((l) => l.etapa === filtro);
  const activos = leads.filter((l) => l.etapa !== 'cerrado');
  const pipeline = activos.reduce((sum, l) => sum + (Number(l.valor) || 0), 0);

  async function eliminarLead(id: string) {
    if (!confirm('Eliminar este lead?')) return;
    try {
      const res = await fetch('/api/leads?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      setMsg('');
      await cargarLeads();
    } catch (e) {
      setMsg('Error al eliminar: ' + (e instanceof Error ? e.message : 'error desconocido'));
    }
  }

  async function enviarLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      nombre: fd.get('nombre'),
      empresa: fd.get('empresa'),
      cargo: fd.get('cargo'),
      producto: fd.get('producto'),
      proyecto: fd.get('proyecto'),
      ultimo_contacto: fd.get('ultimo_contacto'),
      proximo_contacto: fd.get('proximo_contacto'),
      notas: fd.get('notas'),
      etapa: fd.get('etapa'),
    };
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || String(res.status));
      form.reset();
      await cargarLeads();
    } catch (err) {
      setMsg('Error: ' + (err instanceof Error ? err.message : 'error desconocido'));
    }
  }

  function enfocarFormulario() {
    const form = formRef.current;
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const first = form.querySelector<HTMLInputElement>('input[name="nombre"]');
    if (first) setTimeout(() => first.focus(), 350);
  }

  const botonVista = (v: 'kanban' | 'tabla', label: string) => {
    const on = vista === v;
    return (
      <button
        type="button"
        onClick={() => setVista(v)}
        style={{
          padding: '5px 13px',
          minHeight: 'var(--os-tap-min)',
          fontSize: 11,
          fontFamily: 'var(--os-font-display)',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: on ? VIEW_ON_BG : 'transparent',
          color: on ? 'var(--os-accent-light)' : 'var(--os-muted)',
          border: 'none',
          cursor: 'pointer',
          transition: 'background .15s,color .15s',
        }}
      >
        {label}
      </button>
    );
  };

  const pill = (clave: 'todos' | Etapa, label: string) => {
    const on = filtro === clave;
    return (
      <button
        key={clave}
        type="button"
        onClick={() => setFiltro(clave)}
        className={`os-pill${on ? ' os-pill-accent' : ''}`}
        style={{
          border: 'none',
          cursor: 'pointer',
          minHeight: 'var(--os-tap-min)',
          background: on ? VIEW_ON_BG : 'var(--os-fill-subtle)',
          color: on ? 'var(--os-accent-light)' : 'var(--os-muted)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssCrm }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Growth OS</p>
          <h1 className="os-h1">CRM</h1>
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: '4px 0 0' }}>Pipeline de leads y deals</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
            {cargando ? 'Cargando...' : `${leads.length} leads`}
          </p>
          <div style={{ display: 'flex', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)', overflow: 'hidden' }}>
            {botonVista('kanban', 'Kanban')}
            {botonVista('tabla', 'Tabla')}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="os-crm-kpis" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.25rem' }}>
        <div className="os-kpi">
          <p className="os-kpi-label">Revenue Pipeline</p>
          <p className="os-kpi-value">{fmtValor(pipeline) || '$0'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--os-accent-light)' }}>trending_up</span>
            <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Deals abiertos</span>
          </div>
        </div>
        <div className="os-kpi">
          <p className="os-kpi-label">Active Deals</p>
          <p className="os-kpi-value">{activos.length}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--os-accent-light)' }}>workspaces</span>
            <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Sin cerrar</span>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="os-hscroll" style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', paddingBottom: 2 }}>
        {pill('todos', 'Todos')}
        {ETAPAS.map((e) => pill(e, ETAPA_LABEL[e]))}
      </div>

      {/* Quick-add form */}
      <form
        ref={formRef}
        onSubmit={enviarLead}
        className="os-card-2"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem', padding: '1rem' }}
      >
        <input name="nombre" type="text" placeholder="Nombre del lead *" required className="os-input" style={{ ...inputStyle, flex: 2, minWidth: 140 }} />
        <input name="empresa" type="text" placeholder="Empresa" className="os-input" style={{ ...inputStyle, flex: 1, minWidth: 110 }} />
        <input name="cargo" type="text" placeholder="Cargo" className="os-input" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
        <input name="producto" type="text" placeholder="Producto" className="os-input" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
        <select name="proyecto" className="os-input" style={{ ...inputStyle, cursor: 'pointer', background: 'var(--os-bg)' }} defaultValue=""><option value="">Proyecto</option>{proyectos.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input name="proximo_contacto" type="date" title="Próximo contacto" className="os-input" style={inputStyle} />
        <input name="notas" type="text" placeholder="Notas" className="os-input" style={{ ...inputStyle, flex: 2, minWidth: 150 }} />
        <select name="etapa" className="os-input" style={{ ...inputStyle, cursor: 'pointer', background: 'var(--os-bg)' }} defaultValue="nuevo">
          {ETAPAS.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
        </select>
        <button type="submit" className="os-btn" style={{ padding: '6px 16px', fontSize: 'var(--os-text-sm)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Agregar
        </button>
        {msg && <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-error)', width: '100%', margin: 0 }}>{msg}</p>}
      </form>

      {/* Kanban */}
      {vista === 'kanban' && (
        <div className="os-hscroll" style={{ display: 'flex', gap: 12, paddingBottom: '1rem', minHeight: 300 }}>
          {cargando && <div style={{ color: 'var(--os-muted)', fontSize: 13, padding: '1rem 0' }}>Cargando...</div>}
          {!cargando && errorCarga && (
            <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)', padding: '1rem 0' }}>{errorCarga}</div>
          )}
          {!cargando && !errorCarga && (filtro === 'todos' ? ETAPAS : [filtro]).map((etapa) => {
            const ec = ETAPA_COLOR[etapa] ?? ETAPA_COLOR_DEFAULT;
            const cols = visibles.filter((l) => l.etapa === etapa);
            return (
              <div key={etapa} style={{ minWidth: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', marginBottom: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ec.fg, flexShrink: 0 }} />
                  <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0 }}>
                    {ETAPA_LABEL[etapa]}
                  </p>
                  <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 11, color: 'var(--os-muted)', marginLeft: 'auto' }}>{cols.length}</span>
                </div>
                {cols.length === 0 ? (
                  <div style={{ background: 'var(--os-surface-2)', border: '1px dashed var(--os-line)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
                    <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>Sin leads</p>
                  </div>
                ) : cols.map((lead) => (
                  <div key={lead.id} style={{ background: 'var(--os-surface)', border: '1px solid var(--os-line)', borderRadius: 12, padding: '0.875rem', position: 'relative', boxShadow: 'var(--os-shadow-card)' }}>
                    <button
                      type="button"
                      onClick={() => void eliminarLead(lead.id)}
                      title="Eliminar"
                      style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', fontSize: 16, lineHeight: 1, padding: 0, minWidth: 'var(--os-tap-min)', minHeight: 'var(--os-tap-min)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 30px 4px 0' }}>
                      {esPrioritario(lead) && (
                        <span className="material-symbols-outlined fill" style={{ fontSize: 15, color: 'var(--os-champagne)', flexShrink: 0 }}>star</span>
                      )}
                      <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)', margin: 0 }}>{lead.nombre}</p>
                    </div>
                    {lead.empresa && <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0 0 6px' }}>{lead.empresa}</p>}
                    {Boolean(lead.valor) && (
                      <p style={{ fontFamily: 'var(--os-font-mono)', fontSize: 'var(--os-text-sm)', fontWeight: 700, color: 'var(--os-champagne)', margin: '0 0 6px' }}>{fmtValor(lead.valor)}</p>
                    )}
                    {lead.proyecto && <p style={{ fontSize: 11, color: 'var(--os-text)', margin: '0 0 6px' }}>{lead.proyecto}</p>}
                    {lead.notas && <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{lead.notas}</p>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ec.fg, background: ec.bg }}>
                      {ETAPA_LABEL[etapa]}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla */}
      {vista === 'tabla' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr>
                {['Lead', 'Empresa', 'Cargo', 'Producto', 'Proyecto', 'Próximo contacto', 'Notas', 'Etapa'].map((h) => (
                  <th key={h} style={{ ...thStyle, textAlign: 'left' }}>{h}</th>
                ))}
                {['Prob %', 'Scoring', 'Valor'].map((h) => (
                  <th key={h} style={{ ...thStyle, textAlign: 'right' }}>{h}</th>
                ))}
                <th style={{ ...thStyle, textAlign: 'left' }}>Etiquetas</th>
                <th style={{ borderBottom: '1px solid var(--os-line)', padding: '8px 10px' }} />
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>Cargando...</td></tr>
              )}
              {!cargando && !visibles.length && (
                <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' }}>Sin leads. Agrega uno arriba.</td></tr>
              )}
              {!cargando && visibles.map((l) => {
                const ec = ETAPA_COLOR[l.etapa ?? ''] ?? ETAPA_COLOR_DEFAULT;
                const etapaLabel = ETAPA_LABEL[l.etapa ?? ''] ?? l.etapa;
                const tags = l.etiquetas ?? [];
                return (
                  <tr
                    key={l.id}
                    style={{ borderBottom: '1px solid var(--os-line-soft)', transition: 'background .12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59,78,217,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '9px 10px', color: 'var(--os-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {esPrioritario(l) && (
                        <span className="material-symbols-outlined fill" style={{ fontSize: 13, color: 'var(--os-champagne)', verticalAlign: 'middle', marginRight: 5 }}>star</span>
                      )}
                      {l.nombre}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{l.empresa ?? ''}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{l.cargo ?? ''}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{l.producto ?? ''}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{l.proyecto ?? ''}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-text-2)', whiteSpace: 'nowrap' }}>{l.proximo_contacto ?? ''}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--os-muted)', maxWidth: 180 }}>{l.notas ?? ''}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--os-font-display)', letterSpacing: '0.05em', color: ec.fg, background: ec.bg, padding: '2px 9px', borderRadius: 999 }}>
                        {etapaLabel}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>{l.probabilidad || 0}%</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>{l.scoring || 0}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--os-champagne)', fontFamily: 'var(--os-font-mono)', fontWeight: 700 }}>{l.valor ? fmtValor(l.valor) : ''}</td>
                    <td style={{ padding: '9px 10px' }}>
                      {tags.length ? tags.map((t, i) => (
                        <span key={i} style={{ fontSize: 11, color: 'var(--os-muted)', background: 'var(--os-fill-subtle)', padding: '2px 7px', borderRadius: 4, marginRight: 3 }}>{t}</span>
                      )) : <span style={{ color: 'var(--os-muted)', fontSize: 11 }}>-</span>}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => void eliminarLead(l.id)}
                        title="Eliminar"
                        style={{ background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer', padding: 0, lineHeight: 1, minWidth: 'var(--os-tap-min)', minHeight: 'var(--os-tap-min)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* FAB: enfoca el quick-add */}
      <button className="os-fab" type="button" onClick={enfocarFormulario} aria-label="Agregar lead">
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>add</span>
      </button>
    </>
  );
}
