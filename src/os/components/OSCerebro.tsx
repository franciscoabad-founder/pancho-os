// OSCerebro — cuerpo de la pagina /cerebro, portado de los <script is:inline>
// de src/pages/cerebro.astro.
//
// El .astro pintaba todo a mano con innerHTML y addEventListener sobre nodos
// creados por Astro. En un arbol React esos nodos son del framework, asi que
// aca la misma UI se expresa como estado: buscador con debounce, grilla de
// notas paginada y filtrable por tag, y modal de nota. El grafo sigue siendo el
// mismo componente de siempre (OSGraphBrain).
//
// Se conserva literal:
//   - la lista cerrada de tags de CLAUDE.md y el chip "Todas"
//   - el debounce de 380 ms y el disparo inmediato con Enter
//   - la ventana de paginacion estilo Google (hasta 10 numeros centrados)
//   - limit=12 por pagina
//   - el mini renderer de markdown del modal
import { useCallback, useEffect, useRef, useState } from 'react';
import OSGraphBrain from './OSGraphBrain.tsx';

// Lista cerrada de tags validos del brain (CLAUDE.md). No se inventan tags.
const TAGS = [
  'braintech', 'cortex', 'taskr', 'rafik', 'arazza', 'codeis', 'kronek', 'fonquito',
  'flow', 'os', 'panchoatlas', 'gbrain', 'hermes', 'n8n', 'vps', 'marca', 'personal',
  'familia', 'salud', 'finanzas', 'contenido', 'gtm',
];

const LIMITE = 12;
const DEBOUNCE_MS = 380;

interface NotaResumen {
  slug: string;
  titulo: string;
  resumen: string;
  tags: string[];
  tipo: string;
  fecha: string;
}

interface RespuestaNotas {
  notes: NotaResumen[];
  total: number;
  page: number;
  pages: number;
}

interface ResultadoBusqueda {
  slug: string;
  titulo: string;
  resumen: string;
}

interface NotaDetalle {
  slug: string;
  titulo: string;
  tipo: string;
  tags: string[];
  contenido: string;
  fecha: string;
}

// Mini renderer de markdown del modal, identico al del .astro. El texto ya pasa
// por React en todos los campos cortos; solo el cuerpo compilado necesita HTML,
// y por eso se escapa antes de aplicar las sustituciones.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToHtml(md: string): string {
  return esc(md)
    .replace(/^#### (.+)$/gm, '<b style="color:var(--os-accent-light);font-size:12px;">$1</b>')
    .replace(/^### (.+)$/gm, '<b style="color:var(--os-text-2);font-size:13px;">$1</b>')
    .replace(/^## (.+)$/gm, '<b style="color:var(--os-text);font-size:14px;">$1</b>')
    .replace(/^# (.+)$/gm, '<b style="color:var(--os-text);font-size:16px;">$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(59,78,217,0.18);padding:1px 5px;border-radius:3px;font-size:12px;">$1</code>')
    .replace(/^- (.+)$/gm, '<span style="display:block;padding-left:12px;">• $1</span>')
    .replace(/^\d+\. (.+)$/gm, '<span style="display:block;padding-left:12px;">$1</span>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

const cssCerebro = `
  .nota-card:hover { border-color: var(--os-line-accent) !important; }
  .result-card:hover { border-color: var(--os-line-accent) !important; }
  #brain-search::placeholder { color: var(--os-muted); }
  #notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

  @media (max-width: 820px) {
    #notes-grid { grid-template-columns: 1fr; }
    .graph-card { padding: 0.875rem !important; }
  }
`;

const chipTag = { fontSize: 11, color: 'var(--os-muted)', background: 'var(--os-fill-subtle)', padding: '2px 7px', borderRadius: 4 } as const;

// Ventana de numeros estilo Google: hasta 10 paginas visibles centradas en la
// actual. Identico al calculo del .astro.
function ventanaPaginas(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 4, pages - 9));
  const end = Math.min(pages, start + 9);
  const out: number[] = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
}

export default function OSCerebro() {
  // --- Grilla de notas ---
  const [page, setPage] = useState(1);
  const [tag, setTag] = useState('');
  const [notas, setNotas] = useState<RespuestaNotas | null>(null);
  const [cargandoNotas, setCargandoNotas] = useState(true);
  const [errorNotas, setErrorNotas] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargandoNotas(true);
    setErrorNotas(false);
    const params = new URLSearchParams({ limit: String(LIMITE), page: String(page) });
    if (tag) params.set('tag', tag);

    fetch(`/api/brain/notes?${params.toString()}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data: RespuestaNotas) => { if (vigente) { setNotas(data); setCargandoNotas(false); } })
      .catch(() => { if (vigente) { setErrorNotas(true); setCargandoNotas(false); } });

    return () => { vigente = false; };
  }, [page, tag]);

  const irAPagina = useCallback((p: number) => {
    setPage(p);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // --- Buscador ---
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(false);

  const buscar = useCallback(async (q: string) => {
    setBuscando(true);
    setErrorBusqueda(false);
    try {
      const res = await fetch(`/api/brain/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { results?: ResultadoBusqueda[] } = await res.json();
      setResultados(data.results ?? []);
    } catch {
      setErrorBusqueda(true);
      setResultados(null);
    }
    setBuscando(false);
  }, []);

  // Debounce de 380 ms, igual que el .astro. Con la caja vacia se esconde el
  // panel de resultados en vez de buscar cadena vacia.
  useEffect(() => {
    const q = consulta.trim();
    if (!q) { setResultados(null); setBuscando(false); setErrorBusqueda(false); return; }
    const t = setTimeout(() => { void buscar(q); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [consulta, buscar]);

  const busquedaVisible = consulta.trim().length > 0;

  // --- Modal de nota ---
  const [slugAbierto, setSlugAbierto] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaDetalle | null>(null);
  const [errorNota, setErrorNota] = useState('');

  useEffect(() => {
    if (!slugAbierto) return;
    let vigente = true;
    setNota(null);
    setErrorNota('');
    fetch(`/api/brain/note?slug=${encodeURIComponent(slugAbierto)}`)
      .then((r) => r.json())
      .then((n: NotaDetalle & { error?: string }) => {
        if (!vigente) return;
        if (n.error) setErrorNota(n.error);
        else setNota(n);
      })
      .catch(() => { if (vigente) setErrorNota('Error al cargar la nota.'); });
    return () => { vigente = false; };
  }, [slugAbierto]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSlugAbierto(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const totalNotas = notas?.total ?? null;

  return (
    <div className="os-fade-up">
      <style dangerouslySetInnerHTML={{ __html: cssCerebro }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.75rem' }}>
        <div>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Conocimiento</p>
          <h1 className="os-h1">Cerebro</h1>
        </div>
        <p className="os-num" style={{ fontSize: 13, margin: 0 }}>
          {totalNotas === null ? 'Cargando...' : `${totalNotas} notas indexadas`}
        </p>
      </div>

      {/* Buscador */}
      <div className="os-glass" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '1.25rem', padding: '0 0.5rem 0 1rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)', pointerEvents: 'none', flexShrink: 0 }}>search</span>
        <input
          id="brain-search"
          type="text"
          placeholder="Buscar en gbrain..."
          autoComplete="off"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            // Enter salta el debounce y busca ya.
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const q = consulta.trim();
            if (q) void buscar(q);
          }}
          style={{ flex: 1, background: 'transparent', border: 'none', padding: '0.875rem 0.625rem', fontSize: 14, color: 'var(--os-text)', fontFamily: 'var(--os-font-body)', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {/* Resultados de busqueda */}
      {busquedaVisible && (
        <div style={{ marginBottom: '1.5rem' }}>
          {errorBusqueda && <p style={{ color: 'var(--os-error)', fontSize: 12 }}>Error al buscar.</p>}
          {!errorBusqueda && buscando && (
            <p style={{ color: 'var(--os-muted)', fontSize: 12, padding: '0.25rem 0' }}>Buscando...</p>
          )}
          {!errorBusqueda && !buscando && resultados !== null && resultados.length === 0 && (
            <p style={{ color: 'var(--os-muted)', fontSize: 12, padding: '0.25rem 0' }}>Sin resultados.</p>
          )}
          {!errorBusqueda && !buscando && resultados !== null && resultados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultados.map((r) => (
                <div
                  key={r.slug}
                  className="result-card os-card"
                  onClick={() => setSlugAbierto(r.slug)}
                  style={{ padding: '0.875rem 1rem', cursor: 'pointer', transition: 'border-color .15s' }}
                >
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--os-text)', margin: '0 0 4px', fontFamily: 'var(--os-font-display)' }}>{r.titulo}</h4>
                  <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0, lineHeight: 1.4 }}>{r.resumen}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grafo */}
      <div className="os-card os-card-accent graph-card" style={{ marginBottom: '1.5rem', boxShadow: 'var(--os-shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>hub</span>
          <p className="os-section-title" style={{ margin: 0 }}>Grafo de ideas</p>
        </div>
        <OSGraphBrain />
      </div>

      {/* Notas indexadas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>psychology</span>
        <p className="os-section-title" style={{ margin: 0 }}>Notas indexadas</p>
        <span style={{ fontSize: 11, color: 'var(--os-muted)', marginLeft: 'auto' }}>
          {notas && `${notas.total} notas${tag ? ` con #${tag}` : ''} · página ${notas.page} de ${notas.pages}`}
        </span>
      </div>

      {/* Chips de tag */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.875rem' }}>
        {[{ v: '', label: 'Todas' }, ...TAGS.map((t) => ({ v: t, label: `#${t}` }))].map((c) => {
          const activo = tag === c.v;
          return (
            <button
              key={c.v || '__todas'}
              type="button"
              onClick={() => { setTag((actual) => (actual === c.v ? '' : c.v)); setPage(1); }}
              style={{
                fontSize: 11, padding: '4px 12px', minHeight: 32, borderRadius: 99, cursor: 'pointer',
                fontFamily: 'var(--os-font-display)',
                border: `1px solid ${activo ? 'var(--os-accent)' : 'var(--os-line)'}`,
                background: activo ? 'var(--os-accent)' : 'transparent',
                color: activo ? '#fff' : 'var(--os-muted)',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div id="notes-grid" ref={gridRef} style={{ opacity: cargandoNotas ? 0.5 : 1 }}>
        {errorNotas && (
          <div style={{ color: 'var(--os-error)', fontSize: 12, padding: '1rem' }}>Error cargando notas.</div>
        )}
        {!errorNotas && !notas && (
          <div className="os-card" style={{ color: 'var(--os-muted)', fontSize: 13 }}>Cargando notas...</div>
        )}
        {!errorNotas && notas && notas.notes.length === 0 && (
          <div className="os-card" style={{ color: 'var(--os-muted)', fontSize: 13 }}>
            Sin notas{tag ? ` con #${tag}` : ''}.
          </div>
        )}
        {!errorNotas && notas?.notes.map((n) => (
          <div
            key={n.slug}
            className="nota-card os-card"
            onClick={() => setSlugAbierto(n.slug)}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer', transition: 'border-color .15s' }}
          >
            <h3 style={{ fontFamily: 'var(--os-font-display)', fontSize: 13, fontWeight: 700, color: 'var(--os-text)', margin: 0, lineHeight: 1.3 }}>{n.titulo}</h3>
            <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0, lineHeight: 1.45, flex: 1 }}>{n.resumen}</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {n.tags.map((t) => <span key={t} style={chipTag}>#{t}</span>)}
            </div>
            <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: 0 }}>{n.fecha}</p>
          </div>
        ))}
      </div>

      {/* Paginador */}
      {notas && notas.pages > 1 && (
        <nav
          aria-label="Paginacion de notas"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: '1.25rem' }}
        >
          <BotonPagina label="‹" destino={notas.page - 1} deshabilitado={notas.page <= 1} onClick={irAPagina} />
          {ventanaPaginas(notas.page, notas.pages).map((p) => (
            <BotonPagina key={p} label={String(p)} destino={p} actual={p === notas.page} onClick={irAPagina} />
          ))}
          <BotonPagina label="›" destino={notas.page + 1} deshabilitado={notas.page >= notas.pages} onClick={irAPagina} />
        </nav>
      )}

      {/* Modal de nota */}
      {slugAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setSlugAbierto(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(7,17,50,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: '1.5rem', overflow: 'auto' }}
        >
          <div className="os-glass" style={{ maxWidth: 680, margin: '0 auto', borderColor: 'var(--os-line-accent)', padding: '1.75rem', position: 'relative', minHeight: 200, boxShadow: 'var(--os-shadow-modal)' }}>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setSlugAbierto(null)}
              style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: 'var(--os-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >
              x
            </button>
            <div style={{ color: 'var(--os-text)' }}>
              {errorNota && <p style={{ color: 'var(--os-error)' }}>Error: {errorNota}</p>}
              {!errorNota && !nota && <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>Cargando...</p>}
              {!errorNota && nota && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--os-accent-light)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--os-font-display)', fontWeight: 700, margin: '0 0 10px' }}>{nota.tipo}</p>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--os-text)', margin: '0 0 10px', lineHeight: 1.3, fontFamily: 'var(--os-font-display)' }}>{nota.titulo}</h2>
                  <div style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                    {nota.tags.map((t) => (
                      <span key={t} style={{ fontSize: 11, color: 'var(--os-muted)', background: 'var(--os-fill-subtle)', padding: '2px 8px', borderRadius: 4, marginRight: 4 }}>#{t}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0 0 16px' }}>{nota.fecha}</p>
                  <div
                    style={{ fontSize: 13, color: 'var(--os-text-2)', lineHeight: 1.7, borderTop: '1px solid var(--os-line)', paddingTop: 16 }}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(nota.contenido ?? '') }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonPagina({
  label, destino, actual, deshabilitado, onClick,
}: {
  label: string;
  destino: number;
  actual?: boolean;
  deshabilitado?: boolean;
  onClick: (p: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={deshabilitado}
      onClick={() => { if (!deshabilitado) onClick(destino); }}
      style={{
        minWidth: 36, minHeight: 36, padding: '4px 10px', borderRadius: 8, fontSize: 13,
        fontFamily: 'var(--os-font-display)', cursor: deshabilitado ? 'default' : 'pointer',
        border: `1px solid ${actual ? 'var(--os-accent)' : 'transparent'}`,
        background: actual ? 'var(--os-accent)' : 'transparent',
        color: actual ? '#fff' : (deshabilitado ? 'var(--os-line)' : 'var(--os-accent-light)'),
      }}
    >
      {label}
    </button>
  );
}
