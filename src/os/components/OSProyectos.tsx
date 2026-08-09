import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Spinner, ToastProvider, useToast } from './ui';

// Vista Proyectos: el Project Stack del canon, en vivo desde /api/os/lineas.
// prioridad_stack es la unica jerarquia que importa: 0 Urgente, 1 Dinero,
// 2 Soporte, 3 Estabilizar, 4 Pausado. Un proyecto pausado no recibe atencion,
// esa es la funcion del stack.

interface Linea {
  id: string;
  nombre: string;
  descripcion: string | null;
  prioridad_stack: number;
  recibe_maker: boolean;
  objetivo_id: string | null;
  siguiente_accion: string | null;
  estado: string | null;
  orden: number | null;
  brain_tag: string | null;
}

interface ProyectoPagina {
  slug: string;
  titulo: string;
  tipo: string;
  tags: string[];
  brief: string;
  pendientes: string[];
  fecha: string;
}

const PRIORIDAD_LABEL: Record<number, string> = {
  0: 'Urgente', 1: 'Dinero', 2: 'Soporte', 3: 'Estabilizar', 4: 'Pausado',
};
const PRIORIDAD_HINT: Record<number, string> = {
  0: 'Riesgo activo: legal, financiero o reputacional.',
  1: 'Genera o protege ingresos ahora.',
  2: 'Sostiene lo que ya funciona.',
  3: 'Necesita orden antes de crecer.',
  4: 'Cero atencion a proposito.',
};
const PRIORIDAD_COLOR: Record<number, string> = {
  0: 'var(--os-error)',
  1: 'var(--os-champagne)',
  2: 'var(--os-accent-light)',
  3: 'var(--os-text-2)',
  4: 'var(--os-muted)',
};
const ORDEN_STACK = [0, 1, 2, 3, 4];

// Formato minimo de markdown a JSX para el brief que devuelve el cerebro.
function renderBrief(md: string) {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const h4 = line.match(/^#### (.*)$/);
    const h3 = line.match(/^### (.*)$/);
    const h2 = line.match(/^## (.*)$/);
    const h1 = line.match(/^# (.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (h4) return <p key={i} style={{ color: 'var(--os-accent)', fontSize: 12, fontWeight: 700, margin: '10px 0 2px' }}>{h4[1]}</p>;
    if (h3) return <p key={i} style={{ color: 'var(--os-text-2)', fontSize: 13, fontWeight: 700, margin: '10px 0 2px' }}>{h3[1]}</p>;
    if (h2) return <p key={i} style={{ color: 'var(--os-text)', fontSize: 14, fontWeight: 700, margin: '10px 0 2px' }}>{h2[1]}</p>;
    if (h1) return <p key={i} style={{ color: 'var(--os-text)', fontSize: 16, fontWeight: 700, margin: '10px 0 2px' }}>{h1[1]}</p>;
    if (bullet) return <p key={i} style={{ margin: '0 0 3px', paddingLeft: 12 }}>&bull; {bullet[1]}</p>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} style={{ margin: '0 0 4px' }}>{line}</p>;
  });
}

const selectStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 11,
  fontFamily: 'var(--os-font-display)',
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
};

function OSProyectosInner() {
  const toast = useToast();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalNombre, setModalNombre] = useState('');
  const [modalTag, setModalTag] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalPaginas, setModalPaginas] = useState<ProyectoPagina[]>([]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  async function abrirProyecto(l: Linea) {
    if (!l.brain_tag) return;
    setModalOpen(true);
    setModalNombre(l.nombre);
    setModalTag(l.brain_tag);
    setModalLoading(true);
    setModalError('');
    setModalPaginas([]);
    try {
      const res = await fetch(`/api/brain/proyecto?tag=${encodeURIComponent(l.brain_tag)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || String(res.status));
      setModalPaginas(data.paginas ?? []);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : String(err));
    } finally {
      setModalLoading(false);
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/os/lineas', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setLineas(data.lineas ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/os/lineas?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  function editarSiguienteAccion(l: Linea) {
    const val = window.prompt('Siguiente accion:', l.siguiente_accion || '');
    if (val === null) return;
    patch(l.id, { siguiente_accion: val.trim() || null });
  }

  const porStack = useMemo(() => {
    const grupos: Record<number, Linea[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const l of lineas) {
      const k = grupos[l.prioridad_stack] ? l.prioridad_stack : 4;
      grupos[k].push(l);
    }
    for (const k of ORDEN_STACK) {
      grupos[k].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
    }
    return grupos;
  }, [lineas]);

  if (loading) {
    return <Spinner label="Cargando proyectos..." />;
  }
  if (error && lineas.length === 0) {
    return (
      <div className="os-card-2" style={{ padding: '1rem' }}>
        <p style={{ color: 'var(--os-error)', fontSize: 13, margin: 0 }}>No se pudo cargar el stack de proyectos: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 12, margin: 0 }}>{error}</p>}

      {lineas.length === 0 && (
        <div className="os-card-2">
          <EmptyState
            icon="account_tree"
            title="Stack vacio"
            text="Todavia no hay lineas registradas. Las lineas del Project Stack se registran via API (/api/os/lineas)."
          />
        </div>
      )}

      {ORDEN_STACK.map((stack) => {
        const items = porStack[stack];
        if (items.length === 0) return null;
        return (
          <div key={stack}>
            <p className="os-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2, background: PRIORIDAD_COLOR[stack], display: 'inline-block', flexShrink: 0,
              }} />
              {stack} · {PRIORIDAD_LABEL[stack]}
              <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: 'var(--os-muted)' }}>
                — {PRIORIDAD_HINT[stack]}
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((l) => (
                <div
                  key={l.id}
                  className="os-card-2"
                  onClick={() => abrirProyecto(l)}
                  style={{
                    borderLeft: `3px solid ${PRIORIDAD_COLOR[stack]}`,
                    opacity: stack === 4 ? 0.7 : 1,
                    cursor: l.brain_tag ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontFamily: 'var(--os-font-display)', fontSize: 15, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>{l.nombre}</h3>
                      {l.recibe_maker && (
                        <span className="os-pill os-pill-accent" title="Recibe tiempo Maker">
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>bolt</span>
                          Maker
                        </span>
                      )}
                      {l.estado && <span className="os-tag">{l.estado}</span>}
                    </div>
                    <select
                      value={l.prioridad_stack}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patch(l.id, { prioridad_stack: Number(e.target.value) })}
                      style={{ ...selectStyle, color: PRIORIDAD_COLOR[l.prioridad_stack] }}
                      title="Cambiar prioridad en el stack"
                    >
                      {ORDEN_STACK.map((s) => (
                        <option key={s} value={s}>{s} · {PRIORIDAD_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                  {l.descripcion && (
                    <p style={{ fontSize: 13, color: 'var(--os-muted)', margin: '0 0 0.625rem', lineHeight: 1.45 }}>{l.descripcion}</p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); editarSiguienteAccion(l); }}
                    title="Editar siguiente accion"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: PRIORIDAD_COLOR[l.prioridad_stack], flexShrink: 0, marginTop: 1 }}>chevron_right</span>
                    <span style={{ fontSize: 13, color: l.siguiente_accion ? 'var(--os-text)' : 'var(--os-muted)', margin: 0, lineHeight: 1.45 }}>
                      {l.siguiente_accion || '+ definir siguiente accion'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
          style={{
            display: 'flex', position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
            padding: '1.5rem', overflow: 'auto', alignItems: 'flex-start', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 680, width: '100%', margin: '2rem 0', background: 'var(--os-surface)',
              border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-card)', padding: '1.75rem',
              position: 'relative', minHeight: 160, boxShadow: 'var(--os-shadow-modal)',
            }}
          >
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Cerrar"
              style={{
                position: 'absolute', top: 14, right: 16, background: 'none', border: 'none',
                color: 'var(--os-muted)', cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
            </button>

            <p style={{
              fontSize: 11, color: 'var(--os-accent-light)', letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: 'var(--os-font-display)', margin: '0 0 6px',
            }}>
              Proyecto · #{modalTag}
            </p>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--os-text)', margin: '0 0 1rem', fontFamily: 'var(--os-font-display)' }}>
              {modalNombre}
            </h2>

            {modalLoading && (
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>Leyendo el cerebro...</p>
            )}

            {!modalLoading && modalError && (
              <p style={{ color: 'var(--os-error)', fontSize: 13 }}>Error: {modalError}</p>
            )}

            {!modalLoading && !modalError && modalPaginas.length === 0 && (
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>
                Sin contexto en el cerebro para esta linea. Captura notas con el tag <b>#{modalTag}</b> y apareceran aqui.
              </p>
            )}

            {!modalLoading && !modalError && modalPaginas.map((p, i) => (
              <div key={p.slug} style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--os-line-soft)',
                paddingTop: i === 0 ? 0 : 14, marginTop: i === 0 ? 0 : 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: 0, fontFamily: 'var(--os-font-display)' }}>
                    {p.titulo}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--os-muted)', flexShrink: 0 }}>{p.fecha}</span>
                </div>
                {p.brief ? (
                  <div style={{ fontSize: 13, color: 'var(--os-text-2)', lineHeight: 1.65 }}>{renderBrief(p.brief)}</div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--os-muted)' }}>Sin brief.</p>
                )}
                {p.pendientes.length > 0 && (
                  <div style={{
                    marginTop: 10, background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)',
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <p style={{
                      fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--os-accent-light)', margin: '0 0 6px',
                    }}>
                      Pendientes
                    </p>
                    {p.pendientes.map((x, j) => (
                      <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 13, color: 'var(--os-text)', lineHeight: 1.5, marginBottom: 3 }}>
                        <span style={{ color: 'var(--os-accent)', flexShrink: 0 }}>&#9656;</span>
                        <span>{x}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OSProyectos() {
  return (
    <ToastProvider>
      <OSProyectosInner />
    </ToastProvider>
  );
}
