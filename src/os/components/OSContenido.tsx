import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Spinner, ToastProvider, useConfirm, useToast } from './ui';

// Vista Contenido: pipeline editorial en vivo desde /api/os/contenido.

interface Idea {
  id: string;
  titulo: string;
  formato: string;
  idea_madre: string | null;
  repurposing: string[];
  status: string;
  plataformas: string[];
  fecha_target: string | null;
  url_referencia?: string | null;
  transcript?: string | null;
}

const STATUS_ORDEN = ['idea', 'en-produccion', 'publicado', 'archivado'];
const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea', 'en-produccion': 'En produccion', publicado: 'Publicado', archivado: 'Archivado',
};
const STATUS_COLOR: Record<string, string> = {
  idea: 'var(--os-muted)',
  'en-produccion': 'var(--os-accent-light)',
  publicado: 'var(--os-champagne)',
  archivado: 'var(--os-muted)',
};
const FORMATO_LABEL: Record<string, string> = {
  hilo: 'Hilo', post: 'Post', articulo: 'Articulo', video: 'Video', newsletter: 'Newsletter',
};
const FORMATOS = Object.keys(FORMATO_LABEL);

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
const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '6px 10px',
  minHeight: 36,
  boxSizing: 'border-box',
  fontSize: 'var(--os-text-sm)',
  color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)',
  outline: 'none',
};

const listaDesdeTexto = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function OSContenidoInner() {
  const toast = useToast();
  const { confirm, sheet } = useConfirm();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [creando, setCreando] = useState(false);
  const [nTitulo, setNTitulo] = useState('');
  const [nFormato, setNFormato] = useState('post');
  const [nIdeaMadre, setNIdeaMadre] = useState('');
  const [nPlataformas, setNPlataformas] = useState('');
  const [nFecha, setNFecha] = useState('');
  const [nUrl, setNUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [transcriptsAbiertos, setTranscriptsAbiertos] = useState<Set<string>>(new Set());

  function toggleTranscript(id: string) {
    setTranscriptsAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  async function load() {
    try {
      const res = await fetch('/api/os/contenido', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setIdeas(data.ideas ?? []);
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
      const res = await fetch(`/api/os/contenido?id=${encodeURIComponent(id)}`, {
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

  async function eliminar(id: string) {
    if (!(await confirm({
      title: 'Eliminar idea',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    }))) return;
    try {
      const res = await fetch(`/api/os/contenido?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  function editarRepurposing(idea: Idea) {
    const val = window.prompt('Repurposing (separado por comas):', idea.repurposing.join(', '));
    if (val === null) return;
    patch(idea.id, { repurposing: listaDesdeTexto(val) });
  }

  function editarPlataformas(idea: Idea) {
    const val = window.prompt('Plataformas (separado por comas):', idea.plataformas.join(', '));
    if (val === null) return;
    patch(idea.id, { plataformas: listaDesdeTexto(val) });
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nTitulo.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/os/contenido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: nTitulo.trim(),
          formato: nFormato,
          idea_madre: nIdeaMadre.trim() || null,
          repurposing: [],
          status: 'idea',
          plataformas: listaDesdeTexto(nPlataformas),
          fecha_target: nFecha || null,
          url_referencia: nUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setNTitulo(''); setNIdeaMadre(''); setNPlataformas(''); setNFecha(''); setNUrl('');
      setCreando(false);
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setBusy(false);
    }
  }

  const enProduccion = useMemo(() => ideas.filter((i) => i.status === 'en-produccion').length, [ideas]);
  const ordenadas = useMemo(
    () => [...ideas]
      .filter((i) => filtroStatus === 'todos' || i.status === filtroStatus)
      .sort((a, b) => STATUS_ORDEN.indexOf(a.status) - STATUS_ORDEN.indexOf(b.status)),
    [ideas, filtroStatus],
  );

  if (loading) {
    return <Spinner label="Cargando pipeline editorial..." />;
  }
  if (error && ideas.length === 0) {
    return (
      <div className="os-card-2" style={{ padding: '1rem' }}>
        <p style={{ color: 'var(--os-error)', fontSize: 13, margin: 0 }}>No se pudo cargar el contenido: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--os-error)', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['todos', ...STATUS_ORDEN].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={filtroStatus === s ? 'os-pill os-pill-accent' : 'os-pill'}
              style={{ cursor: 'pointer', border: filtroStatus === s ? 'none' : '1px solid var(--os-line)', background: filtroStatus === s ? undefined : 'transparent', color: filtroStatus === s ? undefined : 'var(--os-muted)', minHeight: 30 }}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <span className="os-pill os-pill-accent">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit_note</span>
          <span className="os-num" style={{ color: 'inherit' }}>{enProduccion}</span> en produccion
        </span>
        <Button size="sm" variant={creando ? 'ghost' : 'primary'} onClick={() => setCreando((v) => !v)}>
          {creando ? 'Cancelar' : '+ Nueva idea'}
        </Button>
      </div>

      {creando && (
        <form onSubmit={agregar} className="os-card-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <input value={nTitulo} onChange={(e) => setNTitulo(e.target.value)} placeholder="Titulo *" required style={{ ...inputStyle, flexBasis: '100%' }} />
          <select value={nFormato} onChange={(e) => setNFormato(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
          </select>
          <input type="date" value={nFecha} onChange={(e) => setNFecha(e.target.value)} style={inputStyle} />
          <input value={nPlataformas} onChange={(e) => setNPlataformas(e.target.value)} placeholder="Plataformas (LinkedIn, Blog...)" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          <input value={nUrl} onChange={(e) => setNUrl(e.target.value)} placeholder="Link del video de referencia (opcional)" type="url" style={{ ...inputStyle, flexBasis: '100%' }} />
          <textarea value={nIdeaMadre} onChange={(e) => setNIdeaMadre(e.target.value)} placeholder="Idea madre" rows={2} style={{ ...inputStyle, flexBasis: '100%', resize: 'vertical', fontFamily: 'var(--os-font-body)' }} />
          <Button type="submit" size="sm" disabled={busy}>{busy ? '...' : 'Guardar'}</Button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ordenadas.length === 0 && (
          <div className="os-card-2">
            <EmptyState
              icon="edit_note"
              title="Sin ideas todavia"
              text="El pipeline editorial empieza vacio. Captura la primera idea."
              action={!creando ? <Button size="sm" onClick={() => setCreando(true)}>+ Nueva idea</Button> : undefined}
            />
          </div>
        )}
        {ordenadas.map((idea) => (
          <div key={idea.id} className={idea.status === 'en-produccion' ? 'os-card-2 os-card-accent' : 'os-card-2'}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="os-tag" style={{ fontFamily: 'var(--os-font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {FORMATO_LABEL[idea.formato] ?? idea.formato}
                </span>
                <select
                  value={idea.status}
                  onChange={(e) => patch(idea.id, { status: e.target.value })}
                  style={{ ...selectStyle, color: STATUS_COLOR[idea.status] ?? 'var(--os-muted)' }}
                >
                  {STATUS_ORDEN.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {idea.fecha_target && <span className="os-num" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{idea.fecha_target}</span>}
                <button onClick={() => eliminar(idea.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', padding: 0, minWidth: 36, minHeight: 36, lineHeight: 1 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
            </div>

            <h3 style={{ fontFamily: 'var(--os-font-display)', fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>{idea.titulo}</h3>
            {idea.idea_madre && (
              <p style={{ fontSize: 13, color: 'var(--os-text-2)', margin: '0 0 0.875rem', lineHeight: 1.45 }}>{idea.idea_madre}</p>
            )}

            {idea.url_referencia && (
              <a href={idea.url_referencia} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--os-accent-light)', textDecoration: 'none', marginBottom: '0.625rem', minHeight: 30 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                Ver video original
              </a>
            )}
            {idea.transcript && (
              <div style={{ marginBottom: '0.75rem' }}>
                <button onClick={() => toggleTranscript(idea.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--os-muted)', fontSize: 12, fontFamily: 'var(--os-font-display)', fontWeight: 600, minHeight: 30 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {transcriptsAbiertos.has(idea.id) ? 'expand_less' : 'expand_more'}
                  </span>
                  {transcriptsAbiertos.has(idea.id) ? 'Ocultar guion' : 'Ver guion transcrito'}
                </button>
                {transcriptsAbiertos.has(idea.id) && (
                  <div style={{ marginTop: 6, padding: '0.75rem 0.875rem', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                    <p style={{ fontSize: 13, color: 'var(--os-text-2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{idea.transcript}</p>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => editarRepurposing(idea)} title="Editar repurposing" style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <p className="os-section-title" style={{ margin: '0 0 0.375rem' }}>Repurposing</p>
              {idea.repurposing.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>+ agregar repurposing</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {idea.repurposing.map((r) => (
                    <li key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--os-accent-light)', flexShrink: 0, marginTop: 1 }}>chevron_right</span>
                      <span style={{ fontSize: 12, color: 'var(--os-text)', lineHeight: 1.4 }}>{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </button>

            <button onClick={() => editarPlataformas(idea)} title="Editar plataformas" style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {idea.plataformas.length === 0
                  ? <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>+ plataformas</span>
                  : idea.plataformas.map((p) => <span key={p} className="os-tag">{p}</span>)}
              </div>
            </button>
          </div>
        ))}
      </div>
      {sheet}
    </div>
  );
}

export default function OSContenido() {
  return (
    <ToastProvider>
      <OSContenidoInner />
    </ToastProvider>
  );
}
