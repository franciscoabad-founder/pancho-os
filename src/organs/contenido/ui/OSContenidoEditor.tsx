import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../os/components/ui';

// Editor de borradores de /redes, ahora con persistencia real.
//
// Hasta este cambio el componente guardaba en useState y nada mas: cero
// fetch(), y el propio codigo lo admitia ("solo en sesion, sin persistencia
// todavia"). Cualquier borrador se perdia al refrescar la pagina. Ahora escribe
// contra os_contenido_ideas por /api/contenido (server route
// src/routes/api/contenido.ts -> ../server/ideas.handlers.ts).
//
// Dos caminos de guardado, los dos reales:
//   - Autoguardado: tras AUTOGUARDADO_MS sin escribir, el borrador se crea
//     (POST) o se actualiza (PATCH). No hay forma de perder lo escrito por
//     refrescar.
//   - Boton "Guardar borrador": fuerza el guardado y deja el formulario limpio
//     para el siguiente, que es el gesto que ya existia.
//
// Mapeo contra la tabla, que es compartida con el pipeline editorial de
// /contenido: formato 'borrador' marca las piezas nacidas aca (asi el editor
// lista las suyas y no todo el pipeline), el cuerpo va a idea_madre (la unica
// columna de texto largo garantizada, sin depender de migraciones opcionales) y
// la plataforma elegida a plataformas[]. Un borrador es entonces una idea real
// del pipeline desde el minuto uno, no un objeto aparte.

const PLATAFORMAS = ['linkedin', 'instagram', 'blog'] as const;
type Plataforma = typeof PLATAFORMAS[number];

const FORMATO_BORRADOR = 'borrador';
const AUTOGUARDADO_MS = 1200;

interface Borrador {
  id: string;
  titulo: string;
  cuerpo: string;
  plataforma: string;
  fecha: string;
}

// Fila cruda de os_contenido_ideas, tal como la devuelve /api/contenido.
interface IdeaApi {
  id: string;
  titulo: string;
  formato: string | null;
  idea_madre: string | null;
  plataformas: string[] | null;
  created_at?: string;
}

const PLAT_COLOR: Record<string, string> = {
  linkedin:  'var(--os-accent)',
  instagram: 'var(--os-champagne)',
  blog:      'var(--os-accent-light)',
};
// Tints con alpha (var() no se puede concatenar con sufijo hex).
const PLAT_BG: Record<string, string> = {
  linkedin:  'rgba(59,78,217,0.13)',
  instagram: 'rgba(181,152,90,0.13)',
  blog:      'rgba(107,122,232,0.13)',
};

const TITULO_VACIO = '(sin titulo)';

function formatearFecha(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function desdeApi(idea: IdeaApi): Borrador {
  return {
    id: idea.id,
    titulo: idea.titulo || TITULO_VACIO,
    cuerpo: idea.idea_madre ?? '',
    plataforma: idea.plataformas?.[0] ?? 'linkedin',
    fecha: formatearFecha(idea.created_at),
  };
}

async function pedir(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data;
}

export default function OSContenidoEditor() {
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [plataforma, setPlataforma] = useState<Plataforma>('linkedin');
  const [guardando, setGuardando] = useState(false);
  const [flash, setFlash] = useState(false);
  const [generandoVariantes, setGenerandoVariantes] = useState(false);
  const [variantes, setVariantes] = useState<Array<{ estilo: string; hook: string; cuerpo: string }>>([]);

  // Ultima version que el servidor ya tiene. Sirve para no disparar un PATCH
  // apenas se carga un borrador en el formulario (nada cambio todavia) y para
  // detectar, al terminar un guardado, si el usuario siguio escribiendo
  // mientras la peticion viajaba.
  const ultimoGuardado = useRef('');
  // Guardado en vuelo: sin esto, dos autoguardados solapados sobre un borrador
  // nuevo (todavia sin id) crearian dos filas en vez de una.
  const enVuelo = useRef(false);

  const instantanea = useCallback(
    (t: string, c: string, p: string) => JSON.stringify([t.trim(), c.trim(), p]),
    [],
  );

  const cargar = useCallback(async () => {
    try {
      const data = (await pedir('/api/contenido?status=idea', { cache: 'no-store' })) as {
        ideas?: IdeaApi[];
      };
      const propios = (data.ideas ?? []).filter((i) => i.formato === FORMATO_BORRADOR);
      setBorradores(propios.map(desdeApi));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // Crea (POST) o actualiza (PATCH) el borrador abierto. Devuelve el id con el
  // que quedo guardado, o null si no habia nada que guardar.
  const persistir = useCallback(async (): Promise<string | null> => {
    const t = titulo.trim();
    const c = cuerpo.trim();
    if (!t && !c) return null;
    if (enVuelo.current) return editandoId;

    const objetivo = instantanea(titulo, cuerpo, plataforma);
    enVuelo.current = true;
    setGuardando(true);
    try {
      const cuerpoPeticion = JSON.stringify({
        titulo: t || TITULO_VACIO,
        formato: FORMATO_BORRADOR,
        idea_madre: c,
        plataformas: [plataforma],
        status: 'idea',
      });
      const cabeceras = { 'Content-Type': 'application/json' };

      let id = editandoId;
      if (id) {
        await pedir(`/api/contenido?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: cabeceras,
          body: cuerpoPeticion,
        });
      } else {
        const data = (await pedir('/api/contenido', {
          method: 'POST',
          headers: cabeceras,
          body: cuerpoPeticion,
        })) as { idea?: IdeaApi };
        if (!data.idea?.id) throw new Error('el servidor no devolvio la idea creada');
        id = data.idea.id;
        setEditandoId(id);
      }

      ultimoGuardado.current = objetivo;
      setError('');
      await cargar();
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }, [titulo, cuerpo, plataforma, editandoId, instantanea, cargar]);

  // Autoguardado: se dispara tras una pausa de escritura, y solo si lo que hay
  // en pantalla difiere de lo que el servidor ya tiene.
  useEffect(() => {
    if (cargando) return;
    const actual = instantanea(titulo, cuerpo, plataforma);
    if (actual === ultimoGuardado.current) return;
    if (!titulo.trim() && !cuerpo.trim()) return;
    const temporizador = setTimeout(() => { void persistir(); }, AUTOGUARDADO_MS);
    return () => clearTimeout(temporizador);
  }, [titulo, cuerpo, plataforma, cargando, instantanea, persistir]);

  // Boton explicito: guarda y deja el formulario listo para el siguiente.
  const guardar = async () => {
    if (!titulo.trim() && !cuerpo.trim()) return;
    const id = await persistir();
    if (!id) return;
    limpiar();
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  function limpiar() {
    setEditandoId(null);
    setTitulo('');
    setCuerpo('');
    ultimoGuardado.current = '';
    setVariantes([]);
  }

  async function generarVariantes() {
    if (!titulo.trim() && !cuerpo.trim()) return;
    setGenerandoVariantes(true);
    setError('');

    try {
      const res = await fetch('/api/contenido/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, cuerpo })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error generando variantes');
      }

      if (data.variantes && Array.isArray(data.variantes)) {
        setVariantes(data.variantes);
      } else {
        throw new Error('La respuesta de la IA no tiene el formato esperado');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerandoVariantes(false);
    }
  }

  function aplicarVariante(v: { hook: string; cuerpo: string }) {
    setTitulo(v.hook);
    setCuerpo(v.cuerpo);
    setVariantes([]);
  }

  // Abre un borrador guardado en el formulario. Lo que ya estaba escrito se
  // persiste antes de cambiar de pieza, para no pisarlo.
  async function abrir(b: Borrador) {
    if (b.id === editandoId) return;
    const actual = instantanea(titulo, cuerpo, plataforma);
    if (actual !== ultimoGuardado.current && (titulo.trim() || cuerpo.trim())) {
      await persistir();
    }
    setEditandoId(b.id);
    setTitulo(b.titulo === TITULO_VACIO ? '' : b.titulo);
    setCuerpo(b.cuerpo);
    const p = PLATAFORMAS.includes(b.plataforma as Plataforma) ? (b.plataforma as Plataforma) : 'linkedin';
    setPlataforma(p);
    ultimoGuardado.current = instantanea(b.titulo === TITULO_VACIO ? '' : b.titulo, b.cuerpo, p);
  }

  async function eliminar(id: string) {
    // Optimista: la fila desaparece ya y se reconcilia con cargar().
    setBorradores((prev) => prev.filter((b) => b.id !== id));
    if (id === editandoId) limpiar();
    try {
      await pedir(`/api/contenido?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      await cargar();
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--os-fill-subtle)',
    border: '1px solid var(--os-line)',
    borderRadius: 7,
    padding: '0.625rem 0.75rem',
    minHeight: 36,
    color: 'var(--os-text)',
    fontFamily: 'var(--os-font-body)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const sinGuardar =
    instantanea(titulo, cuerpo, plataforma) !== ultimoGuardado.current &&
    Boolean(titulo.trim() || cuerpo.trim());

  const etiquetaEstado = guardando
    ? 'Guardando...'
    : sinGuardar
      ? 'Sin guardar'
      : editandoId
        ? 'Guardado'
        : '';

  return (
    <div>
      {/* Editor */}
      <div className="os-card-2" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: '0.875rem', flexWrap: 'wrap' }}>
          <p className="os-section-title" style={{ margin: 0 }}>
            {editandoId ? 'Editando borrador' : 'Nuevo borrador'}
          </p>
          <span style={{ fontSize: 'var(--os-text-xs)', color: sinGuardar ? 'var(--os-champagne)' : 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
            {etiquetaEstado}
          </span>
        </div>

        {error && (
          <p style={{ color: 'var(--os-error)', fontSize: 12, margin: '0 0 10px' }}>
            No se pudo guardar: {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PLATAFORMAS.map(p => (
            <button
              key={p}
              onClick={() => setPlataforma(p)}
              style={{
                padding: '3px 10px',
                minHeight: 36,
                borderRadius: 5,
                border: `1px solid ${plataforma === p ? PLAT_COLOR[p] : 'var(--os-line)'}`,
                background: plataforma === p ? PLAT_BG[p] : 'transparent',
                color: plataforma === p ? PLAT_COLOR[p] : 'var(--os-muted)',
                fontFamily: 'var(--os-font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.14s',
              }}
            >{p}</button>
          ))}
        </div>

        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Titulo o hook..."
          style={{ ...inputStyle, fontSize: 'var(--os-text-base)', marginBottom: 8 }}
        />
        <textarea
          value={cuerpo}
          onChange={e => setCuerpo(e.target.value)}
          placeholder="Contenido del post..."
          rows={6}
          style={{ ...inputStyle, fontSize: 'var(--os-text-sm)', resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
            {cuerpo.length} car
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={generarVariantes}
              disabled={generandoVariantes || (!titulo.trim() && !cuerpo.trim())}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>magic_button</span>
              {generandoVariantes ? 'Generando...' : 'Mejorar con IA'}
            </Button>
            {editandoId && (
              <Button size="sm" variant="ghost" onClick={limpiar}>Nuevo</Button>
            )}
            <Button
              size="sm"
              onClick={guardar}
              disabled={guardando || (!titulo.trim() && !cuerpo.trim())}
              style={flash ? { background: 'rgba(59,78,217,0.35)' } : undefined}
            >
              {flash ? 'Guardado' : guardando ? 'Guardando...' : 'Guardar borrador'}
            </Button>
          </div>
        </div>
      </div>

      {variantes.length > 0 && (
        <div className="os-card-2" style={{ marginBottom: '1rem', background: 'var(--os-fill-subtle)', borderColor: 'var(--os-accent-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="os-section-title" style={{ margin: 0, color: 'var(--os-accent-light)' }}>
              Variantes generadas por IA
            </p>
            <button onClick={() => setVariantes([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {variantes.map((v, i) => (
              <div key={i} style={{ padding: 10, background: 'var(--os-bg)', borderRadius: 6, border: '1px solid var(--os-line-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--os-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{v.estilo}</span>
                  <Button size="sm" variant="ghost" onClick={() => aplicarVariante(v)} style={{ height: 24, padding: '0 8px', fontSize: 11 }}>Usar esta</Button>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: 'var(--os-text)' }}>{v.hook}</p>
                <p style={{ fontSize: 12, margin: 0, color: 'var(--os-muted)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{v.cuerpo}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de borradores */}
      <div className="os-card-2">
        <p className="os-section-title" style={{ marginBottom: '0.75rem' }}>
          {cargando ? 'Cargando borradores...' : `Borradores guardados (${borradores.length})`}
        </p>

        {!cargando && borradores.length === 0 && (
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>
            Nada guardado todavia. Lo que escribas arriba se guarda solo y sobrevive al refresco.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {borradores.map(b => (
            <div
              key={b.id}
              style={{
                padding: '0.625rem 0.75rem',
                borderRadius: 7,
                background: 'var(--os-fill-subtle)',
                border: `1px solid ${b.id === editandoId ? 'var(--os-accent)' : 'var(--os-line-soft)'}`,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <button
                onClick={() => { void abrir(b); }}
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--os-text-sm)', fontWeight: 600, color: 'var(--os-text)' }}>{b.titulo}</span>
                  <span style={{ fontSize: 11, color: PLAT_COLOR[b.plataforma] ?? 'var(--os-muted)', fontFamily: 'var(--os-font-display)', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>{b.plataforma}</span>
                  <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', flexShrink: 0 }}>{b.fecha}</span>
                </div>
                {b.cuerpo && (
                  <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {b.cuerpo}
                  </p>
                )}
              </button>
              <button
                onClick={() => { void eliminar(b.id); }}
                aria-label="Eliminar borrador"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', padding: '2px 4px', minWidth: 36, minHeight: 36, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
