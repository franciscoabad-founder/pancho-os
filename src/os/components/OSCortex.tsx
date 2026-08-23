// OSCortex — panel de administracion de Cortex, portado de los dos
// <script is:inline> de src/pages/cortex.astro.
//
// El .astro no tenia componente: era plantilla mas scripts imperativos que
// pintaban KPIs, tabla de tenants, waitlist y actividad con innerHTML, y
// exponian window.cortexLoadOverview para que el formulario de alta pudiera
// refrescar el panel despues de crear un tester. Aca las dos piezas comparten
// arbol, asi que ese puente global desaparece: el formulario llama directo a
// cargarOverview().
//
// Se conserva literal el resto: mismos endpoints, misma validacion del alta,
// mismo copy, mismo orden de la actividad (aprobaciones y uso mezclados por
// fecha descendente, tope de 20) y las mismas zonas horarias del selector.
import { useCallback, useEffect, useState } from 'react';

const ZONAS = [
  'America/Guayaquil',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'US/Eastern',
  'Europe/Madrid',
];

const TZ_POR_DEFECTO = 'America/Guayaquil';

const CABECERAS_TENANTS = ['Slug', 'Nombre', 'Plan', 'Onboarded', 'Miembros', 'Beta email', 'Conexiones'];

// Tope de items visibles en la columna de actividad, igual que el .astro.
const MAX_ACTIVIDAD = 20;

interface Tenant {
  slug: string;
  name?: string;
  plan?: string;
  onboarded_at?: string | null;
  member_count?: number;
  beta_email?: string;
  connections?: string[];
}

interface Lead {
  nombre?: string;
  email?: string;
  empresa?: string;
  created_at?: string;
}

interface Aprobacion {
  titulo?: string;
  tipo?: string;
  estado?: string;
  created_at?: string;
}

interface Uso {
  modelo?: string;
  tipo?: string;
  costo_usd?: number;
  created_at?: string;
}

interface Overview {
  counts?: {
    tenants?: number;
    active?: number;
    beta?: number;
    approvals?: number;
    connections?: number;
    usageThisMonth?: number;
  };
  tenants?: Tenant[];
  waitlist?: Lead[];
  recentApprovals?: Aprobacion[];
  recentUsage?: Uso[];
  error?: string;
}

interface ResultadoAlta {
  login_url?: string;
  email?: string;
  temporary_password?: string;
  email_sent?: boolean;
  restantes?: number;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

const cssCortex = `
  .cortex-field-label {
    display: block;
    font-family: var(--os-font-display);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--os-muted);
    margin-bottom: 5px;
  }
  .cortex-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 820px) {
    .cortex-two-col { grid-template-columns: 1fr; }
  }
  .cortex-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--os-line-soft);
  }
  .cortex-row:last-child { border-bottom: none; }
  details > summary::-webkit-details-marker { display: none; }
`;

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontFamily: 'var(--os-font-display)',
  fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: 'var(--os-muted)', borderBottom: '1px solid var(--os-line)',
};

const tdVacio: React.CSSProperties = { padding: '2rem', textAlign: 'center', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)' };
const pVacio: React.CSSProperties = { padding: '1rem 0', textAlign: 'center', color: 'var(--os-muted)', fontSize: 'var(--os-text-sm)', margin: 0 };

export default function OSCortex() {
  // --- Panel ---
  const [overview, setOverview] = useState<Overview | null>(null);
  const [estadoPanel, setEstadoPanel] = useState('Cargando panel...');
  const [errorPanel, setErrorPanel] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargarOverview = useCallback(async () => {
    setEstadoPanel('Cargando panel...');
    setErrorPanel('');
    setRefrescando(true);
    try {
      const res = await fetch('/api/cortex-admin');
      const data: Overview = await res.json();
      if (!res.ok || data.error) {
        setErrorPanel(data.error || 'No se pudo cargar el panel de Cortex.');
      } else {
        setOverview(data);
        setEstadoPanel(`Actualizado ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch {
      setErrorPanel('Error de conexion con Cortex. Intenta de nuevo.');
    }
    setRefrescando(false);
  }, []);

  useEffect(() => { void cargarOverview(); }, [cargarOverview]);

  const counts = overview?.counts ?? {};
  const kpis: Array<[string, number]> = [
    ['Tenants', counts.tenants ?? 0],
    ['Activos', counts.active ?? 0],
    ['Beta', counts.beta ?? 0],
    ['Aprobaciones pend.', counts.approvals ?? 0],
    ['Conexiones activas', counts.connections ?? 0],
    ['Eventos del mes', counts.usageThisMonth ?? 0],
  ];

  const tenants = overview?.tenants ?? [];
  const waitlist = overview?.waitlist ?? [];

  // Aprobaciones y uso se mezclan en una sola linea de tiempo descendente.
  const actividad = [
    ...(overview?.recentApprovals ?? []).map((a) => ({
      kind: 'Aprobacion',
      label: a.titulo || a.tipo || 'Aprobacion',
      sub: `${a.tipo || '-'}${a.estado ? ` · ${a.estado}` : ''}`,
      date: a.created_at,
    })),
    ...(overview?.recentUsage ?? []).map((u) => ({
      kind: 'Uso',
      label: u.modelo || u.tipo || 'Evento',
      sub: `${u.tipo || '-'}${typeof u.costo_usd === 'number' ? ` · $${u.costo_usd.toFixed(4)}` : ''}`,
      date: u.created_at,
    })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  // --- Alta de tester ---
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [rol, setRol] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tz, setTz] = useState(TZ_POR_DEFECTO);
  const [objetivo, setObjetivo] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);

  const [errorAlta, setErrorAlta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAlta | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Las credenciales para el portapapeles se arman con el mismo formato del
  // .astro: "URL: ... / Email: ... / Password: ...".
  const credenciales = resultado
    ? `URL: ${resultado.login_url || ''} / Email: ${resultado.email || ''}${resultado.temporary_password ? ` / Password: ${resultado.temporary_password}` : ''}`
    : '';

  function limpiarFormulario() {
    setNombre('');
    setEmail('');
    setEmpresa('');
    setRol('');
    setTelefono('');
    setObjetivo('');
    setConsentimiento(false);
    setTz(TZ_POR_DEFECTO);
  }

  async function enviarAlta(e: React.FormEvent) {
    e.preventDefault();
    setErrorAlta('');
    setResultado(null);

    if (!nombre.trim() || !email.trim()) { setErrorAlta('Completa nombre y email.'); return; }
    if (!consentimiento) { setErrorAlta('El consentimiento de datos es obligatorio.'); return; }

    setEnviando(true);
    try {
      const res = await fetch('/api/cortex-invitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          empresa: empresa.trim() || undefined,
          rol: rol.trim() || undefined,
          telefono: telefono.trim() || undefined,
          tz: tz || undefined,
          objetivo: objetivo.trim() || undefined,
          consentimiento_datos: true,
        }),
      });
      const data: ResultadoAlta & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        setErrorAlta(data.error || 'Algo salio mal. Intenta de nuevo.');
      } else {
        setResultado(data);
        setCopiado(false);
        limpiarFormulario();
        // El alta de un tester cambia los datos del panel: refresca.
        void cargarOverview();
      }
    } catch {
      setErrorAlta('Error de conexion. Intenta de nuevo.');
    }
    setEnviando(false);
  }

  function copiarCredenciales() {
    if (!credenciales) return;
    navigator.clipboard.writeText(credenciales).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => { /* portapapeles bloqueado: no hay nada que avisar */ });
  }

  return (
    <div className="os-fade-up">
      <style dangerouslySetInnerHTML={{ __html: cssCortex }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>BrainTech · Cortex</p>
          <h1 className="os-h1">Cortex Admin</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="os-btn os-btn-ghost" disabled={refrescando} onClick={() => void cargarOverview()}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            Actualizar
          </button>
          <a className="os-btn os-btn-ghost" href="https://app-cortex.franciscoabad.com" target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            Abrir app
          </a>
        </div>
      </div>

      {/* Estado de carga / error global */}
      <p style={{ fontSize: 'var(--os-text-sm)', color: errorPanel ? 'var(--os-error)' : 'var(--os-muted)', margin: '0 0 1rem' }}>
        {errorPanel || estadoPanel}
      </p>

      {/* KPIs */}
      <div className="os-kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {kpis.map(([label, valor]) => (
          <div className="os-kpi" key={label}>
            <p className="os-kpi-label">{label}</p>
            <p className="os-kpi-value">{overview ? valor : '-'}</p>
          </div>
        ))}
      </div>

      {/* Alta de tester (colapsable) */}
      <details className="os-card" style={{ marginBottom: '1.5rem' }}>
        <summary className="os-section-title" style={{ cursor: 'pointer', margin: 0, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
          Alta de tester
        </summary>

        <form noValidate onSubmit={enviarAlta} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 560, marginTop: '1rem' }}>
          <div>
            <label htmlFor="ci-nombre" className="cortex-field-label">Nombre *</label>
            <input id="ci-nombre" name="nombre" type="text" required placeholder="Nombre completo" className="os-input" style={{ width: '100%' }} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div>
            <label htmlFor="ci-email" className="cortex-field-label">Email *</label>
            <input id="ci-email" name="email" type="email" required placeholder="tester@correo.com" className="os-input" style={{ width: '100%' }} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="ci-empresa" className="cortex-field-label">Empresa</label>
              <input id="ci-empresa" name="empresa" type="text" placeholder="Empresa" className="os-input" style={{ width: '100%' }} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="ci-rol" className="cortex-field-label">Rol</label>
              <input id="ci-rol" name="rol" type="text" placeholder="Rol / cargo" className="os-input" style={{ width: '100%' }} value={rol} onChange={(e) => setRol(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="ci-telefono" className="cortex-field-label">Telefono</label>
              <input id="ci-telefono" name="telefono" type="text" placeholder="+593 9..." className="os-input" style={{ width: '100%' }} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="ci-tz" className="cortex-field-label">Zona horaria</label>
              <select id="ci-tz" name="tz" className="os-input" style={{ width: '100%' }} value={tz} onChange={(e) => setTz(e.target.value)}>
                {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ci-objetivo" className="cortex-field-label">Hipotesis de uso</label>
            <textarea id="ci-objetivo" name="objetivo" rows={3} placeholder="Que va a probar este tester y para que" className="os-input" style={{ width: '100%', resize: 'vertical' }} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              id="ci-consentimiento"
              name="consentimiento_datos"
              type="checkbox"
              required
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--os-accent)' }}
            />
            <label htmlFor="ci-consentimiento" style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', lineHeight: 1.5 }}>
              El tester consiente el registro de metricas de uso, errores y feedback durante el beta.
            </label>
          </div>

          {errorAlta && (
            <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-error)', margin: 0 }}>{errorAlta}</p>
          )}

          <button type="submit" className="os-btn" disabled={enviando} style={{ alignSelf: 'flex-start' }}>
            {enviando ? 'Provisionando... (puede tardar 1-2 minutos)' : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
                Dar de alta
              </>
            )}
          </button>
        </form>

        {resultado && (
          <div className="os-card os-card-accent" style={{ maxWidth: 560, marginTop: '1rem' }}>
            <p className="os-section-title">Tester creado</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>
              <p>
                <strong style={{ color: 'var(--os-text)' }}>Login:</strong>{' '}
                <a href={resultado.login_url} target="_blank" rel="noopener" style={{ color: 'var(--os-accent-light)' }}>{resultado.login_url}</a>
              </p>
              <p><strong style={{ color: 'var(--os-text)' }}>Email:</strong> {resultado.email}</p>
              {resultado.temporary_password && (
                <>
                  <p>
                    <strong style={{ color: 'var(--os-text)' }}>Password temporal:</strong>{' '}
                    <span className="os-mono">{resultado.temporary_password}</span>
                  </p>
                  <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginTop: 2 }}>
                    La contrasena se muestra UNA sola vez; compartela por canal seguro.
                  </p>
                </>
              )}
              {resultado.email_sent && (
                <p style={{ color: 'var(--os-ok)' }}>El tester ya recibio el correo de bienvenida.</p>
              )}
              {typeof resultado.restantes === 'number' && (
                <p style={{ color: 'var(--os-muted)', fontSize: 'var(--os-text-xs)' }}>Cupos restantes: {resultado.restantes}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="os-btn os-btn-ghost" onClick={copiarCredenciales}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                Copiar credenciales
              </button>
              {copiado && <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-ok)' }}>Copiado.</span>}
            </div>
          </div>
        )}
      </details>

      {/* Tenants */}
      <p className="os-section-title">Tenants</p>
      <div className="os-card-2" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr>
              {CABECERAS_TENANTS.map((h) => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {errorPanel && (
              <tr><td colSpan={7} style={{ ...tdVacio, color: 'var(--os-error)' }}>{errorPanel}</td></tr>
            )}
            {!errorPanel && !overview && <tr><td colSpan={7} style={tdVacio}>Cargando...</td></tr>}
            {!errorPanel && overview && tenants.length === 0 && (
              <tr><td colSpan={7} style={tdVacio}>Sin tenants todavia.</td></tr>
            )}
            {!errorPanel && tenants.map((t) => {
              const onboarded = Boolean(t.onboarded_at);
              const conexiones = t.connections?.length ? t.connections.join(', ') : '-';
              return (
                <tr key={t.slug} style={{ borderBottom: '1px solid var(--os-line-soft)' }}>
                  <td style={{ padding: '9px 10px', color: 'var(--os-text-2)', fontFamily: 'var(--os-font-mono)', whiteSpace: 'nowrap' }}>{t.slug}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--os-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.name || '-'}</td>
                  <td style={{ padding: '9px 10px' }}><span className="os-pill os-pill-accent">{t.plan || '-'}</span></td>
                  <td style={{ padding: '9px 10px', ...(onboarded ? { color: 'var(--os-champagne)', fontWeight: 700 } : { color: 'var(--os-muted)' }) }}>
                    {onboarded ? 'Si' : 'No'}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--os-text-2)', textAlign: 'right' }}>{t.member_count ?? 0}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{t.beta_email || '-'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--os-text-2)' }}>{conexiones}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Waitlist + Actividad */}
      <div className="cortex-two-col">
        <div>
          <p className="os-section-title">Waitlist reciente</p>
          <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {errorPanel && <p style={{ ...pVacio, color: 'var(--os-error)' }}>No se pudo cargar.</p>}
            {!errorPanel && !overview && <p style={pVacio}>Cargando...</p>}
            {!errorPanel && overview && waitlist.length === 0 && <p style={pVacio}>Sin leads todavia.</p>}
            {!errorPanel && waitlist.map((w, i) => (
              <div className="cortex-row" key={`${w.email ?? w.nombre ?? 'lead'}-${i}`}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: 'var(--os-text)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {w.nombre || w.email || 'Sin nombre'}
                  </p>
                  <p style={{ margin: '2px 0 0', color: 'var(--os-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {w.email || ''}{w.empresa ? ` · ${w.empresa}` : ''}
                  </p>
                </div>
                <p style={{ margin: 0, color: 'var(--os-muted)', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(w.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="os-section-title">Actividad reciente</p>
          <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {errorPanel && <p style={{ ...pVacio, color: 'var(--os-error)' }}>No se pudo cargar.</p>}
            {!errorPanel && !overview && <p style={pVacio}>Cargando...</p>}
            {!errorPanel && overview && actividad.length === 0 && <p style={pVacio}>Sin actividad reciente.</p>}
            {!errorPanel && actividad.slice(0, MAX_ACTIVIDAD).map((it, i) => (
              <div className="cortex-row" key={`${it.kind}-${it.label}-${i}`}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: 'var(--os-text)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span className="os-tag" style={{ marginRight: 6 }}>{it.kind}</span>{it.label}
                  </p>
                  <p style={{ margin: '2px 0 0', color: 'var(--os-muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</p>
                </div>
                <p style={{ margin: 0, color: 'var(--os-muted)', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(it.date)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
