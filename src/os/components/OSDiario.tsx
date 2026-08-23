// Timeline del Diario: entradas agrupadas por dia (lo mas nuevo arriba), con
// caja de captura rapida arriba y acciones por entrada (editar, borrar,
// marcar publicable, enviar a contenido) y por dia (sincronizar al brain).
//
// Habla solo con /api/journal y /api/journal/brain-sync. Mismo molde visual que
// OSNotas.tsx.

import { useEffect, useState } from 'react';
import { Button, EmptyState, Spinner } from './ui';

type Tipo = 'dia' | 'proceso' | 'decision' | 'win' | 'idea';

interface Entrada {
  id: string;
  created_at: string;
  fecha: string;
  tipo: Tipo;
  titulo: string | null;
  contenido: string;
  tags: string[];
  fuente: string;
  proyecto: string | null;
  publicable: boolean;
  brain_slug: string | null;
}

const TIPOS: Array<{ valor: Tipo; label: string }> = [
  { valor: 'dia', label: 'Día' },
  { valor: 'proceso', label: 'Proceso' },
  { valor: 'decision', label: 'Decisión' },
  { valor: 'win', label: 'Win' },
  { valor: 'idea', label: 'Idea' },
];

const TIPO_LABEL: Record<Tipo, string> = {
  dia: 'Día', proceso: 'Proceso', decision: 'Decisión', win: 'Win', idea: 'Idea',
};

const PROYECTOS = ['braintech', 'rafik', 'cortex', 'taskr', 'arazza', 'codeis', 'marca', 'personal'];

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
  width: '100%',
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  borderRadius: 6,
  cursor: 'pointer',
  padding: '3px 9px',
  minHeight: 32,
  fontSize: 'var(--os-text-xs)',
  fontFamily: 'var(--os-font-display)',
  fontWeight: 700,
};

const chipApagado: React.CSSProperties = {
  ...chipStyle,
  background: 'none',
  border: '1px solid var(--os-line)',
  color: 'var(--os-muted)',
};

const chipActivo: React.CSSProperties = {
  ...chipStyle,
  background: 'rgba(59,78,217,0.14)',
  border: '1px solid rgba(59,78,217,0.35)',
  color: 'var(--os-accent-light)',
};

function fechaLarga(fecha: string): string {
  // fecha viene como YYYY-MM-DD: se construye local para no correr un dia por UTC.
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function OSDiario() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');

  // Captura rapida
  const [contenido, setContenido] = useState('');
  const [tipo, setTipo] = useState<Tipo>('dia');
  const [proyecto, setProyecto] = useState('');
  const [tags, setTags] = useState('');

  // Edicion en linea
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/journal');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setEntradas(data.entradas ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function llamar(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || String(res.status));
    return data as Record<string, unknown>;
  }

  async function capturar(e: React.FormEvent) {
    e.preventDefault();
    if (!contenido.trim() || busy) return;
    setBusy(true);
    try {
      await llamar('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenido: contenido.trim(),
          tipo,
          proyecto: proyecto || null,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          fuente: 'os',
        }),
      });
      setContenido('');
      setTags('');
      setError('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function accion(fn: () => Promise<unknown>, mensaje?: string) {
    try {
      await fn();
      setError('');
      if (mensaje) setAviso(mensaje);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const togglePublicable = (e: Entrada) => accion(() => llamar(`/api/journal?id=${encodeURIComponent(e.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicable: !e.publicable }),
  }));

  const borrar = (e: Entrada) => {
    if (!globalThis.confirm('Borrar esta entrada del diario?')) return;
    return accion(() => llamar(`/api/journal?id=${encodeURIComponent(e.id)}`, { method: 'DELETE' }));
  };

  const guardarEdicion = (e: Entrada) => accion(async () => {
    await llamar(`/api/journal?id=${encodeURIComponent(e.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: editTexto }),
    });
    setEditandoId(null);
  });

  const enviarAContenido = (e: Entrada) => accion(
    () => llamar('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promover: { id: e.id } }),
    }),
    'Entrada enviada al pipeline de contenido.',
  );

  const sincronizar = (fecha: string) => accion(
    () => llamar('/api/journal/brain-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha }),
    }),
    `Dia ${fecha} sincronizado al brain.`,
  );

  // Agrupacion por dia conservando el orden que ya trae la API.
  const dias: Array<{ fecha: string; items: Entrada[] }> = [];
  for (const e of entradas) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === e.fecha) ultimo.items.push(e);
    else dias.push({ fecha: e.fecha, items: [e] });
  }

  return (
    <div>
      <form onSubmit={capturar} className="os-card-2" style={{ padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {TIPOS.map((t) => (
            <button key={t.valor} type="button" onClick={() => setTipo(t.valor)}
              style={tipo === t.valor ? chipActivo : chipApagado}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={contenido}
          onChange={(ev) => setContenido(ev.target.value)}
          placeholder="Que pasó hoy, que proceso armaste, que decidiste. Esto alimenta tu contenido y tu brain."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={proyecto} onChange={(ev) => setProyecto(ev.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', width: 'auto', minWidth: 150 }}>
            <option value="">Sin proyecto</option>
            {PROYECTOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input value={tags} onChange={(ev) => setTags(ev.target.value)} placeholder="tags separados por coma"
            style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 160 }} />
          <Button type="submit" size="sm" disabled={busy || !contenido.trim()}>
            {busy ? 'Guardando...' : 'Registrar'}
          </Button>
        </div>
      </form>

      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>Error: {error}</p>}
      {aviso && <p style={{ color: 'var(--os-champagne)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>{aviso}</p>}
      {loading && <Spinner />}

      {!loading && !entradas.length && (
        <div className="os-card-2">
          <EmptyState
            icon="auto_stories"
            title="Diario vacio"
            text="Documenta el dia. Cada entrada es materia prima para tu contenido y para la pagina del dia en el brain."
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {dias.map((dia) => (
          <div key={dia.fecha}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h3 style={{
                fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-sm)', fontWeight: 700,
                textTransform: 'capitalize', color: 'var(--os-text)', margin: 0,
              }}>
                {fechaLarga(dia.fecha)}
              </h3>
              {dia.items[0]?.brain_slug && (
                <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
                  {dia.items[0].brain_slug}
                </span>
              )}
              <button type="button" onClick={() => sincronizar(dia.fecha)} style={{ ...chipApagado, marginLeft: 'auto' }}>
                Sincronizar al brain
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dia.items.map((e) => (
                <div key={e.id} style={{
                  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
                  borderRadius: 10, padding: '0.75rem 0.875rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-display)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--os-accent-light)',
                    }}>
                      {TIPO_LABEL[e.tipo]}
                    </span>
                    {e.proyecto && (
                      <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
                        {e.proyecto}
                      </span>
                    )}
                    <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
                      {e.fuente}
                    </span>
                    <button type="button" onClick={() => togglePublicable(e)}
                      title={e.publicable ? 'Marcada como material de contenido' : 'Marcar como material de contenido'}
                      style={{
                        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: e.publicable ? 'var(--os-champagne)' : 'var(--os-muted)',
                      }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {e.publicable ? 'star' : 'star_outline'}
                      </span>
                    </button>
                  </div>

                  {e.titulo && (
                    <p style={{ fontFamily: 'var(--os-font-display)', fontWeight: 700, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: '0 0 4px' }}>
                      {e.titulo}
                    </p>
                  )}

                  {editandoId === e.id ? (
                    <textarea value={editTexto} onChange={(ev) => setEditTexto(ev.target.value)} rows={4}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  ) : (
                    <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {e.contenido}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {e.tags.map((t) => (
                      <span key={t} style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', fontFamily: 'var(--os-font-mono)' }}>
                        #{t}
                      </span>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                      {editandoId === e.id ? (
                        <>
                          <button type="button" onClick={() => guardarEdicion(e)} style={chipActivo}>Guardar</button>
                          <button type="button" onClick={() => setEditandoId(null)} style={chipApagado}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => { setEditandoId(e.id); setEditTexto(e.contenido); }} style={chipApagado}>
                            Editar
                          </button>
                          <button type="button" onClick={() => enviarAContenido(e)} style={chipActivo}>
                            Enviar a contenido
                          </button>
                          <button type="button" onClick={() => borrar(e)} style={chipApagado}>Borrar</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
