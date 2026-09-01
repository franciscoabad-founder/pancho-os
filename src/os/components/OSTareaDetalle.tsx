// Panel de detalle de una tarea: todos los campos con controles reales (cero
// window.prompt), subtareas, y el feed unificado (comentarios + cambios +
// sistema) con caja para comentar. Abre en un Sheet lateral (side='right').
//
// Reglas de la Rebanada A que este componente encarna:
//   - If-Match sobre updated_at: cada PATCH manda la base que vio al cargar;
//     un 409 significa que alguien mas (Pancho en otra pestaña, o Hermes)
//     cambio la tarea mientras tanto, y se recarga en vez de pisar en silencio.
//   - El poll (cada 15s) solo refresca el feed y la base de If-Match, NUNCA
//     los campos del formulario: si tocara los campos, pisaria lo que el
//     usuario esta escribiendo antes de que lo guarde.
//   - El poll se pausa si hay un comentario sin enviar (eso es lo que hay que
//     proteger: perderlo por un refresco automatico).
//   - Escape con un comentario sin enviar pide confirmacion (via Sheet
//     confirmarCierre), no cierra directo.
//   - `cuerpo` de un comentario se renderiza como texto plano, nunca HTML: el
//     texto puede venir de un tercero que Hermes transcribio desde Telegram.

import { useEffect, useRef, useState } from 'react';
import { Sheet, Badge, Button, Spinner, useToast } from './ui';
import { useProyectosActivos } from '../hooks/useProyectosActivos.ts';

interface Tarea {
  id: string;
  titulo: string;
  proyecto: string | null;
  notas: string | null;
  estado: string;
  urgente: boolean;
  deadline: string | null;
  prioridad: 'low' | 'medium' | 'high' | 'critical' | null;
  tipo: string | null;
  grupo: string | null;
  parent_id: string | null;
  orden: number | null;
  created_at: string;
  updated_at: string;
}

interface TareaEvento {
  id: string;
  tarea_id: string;
  tipo: 'comentario' | 'cambio' | 'sistema';
  autor: string | null;
  autor_tipo: string | null;
  origen: string | null;
  cuerpo: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }> | null;
  created_at: string;
  editado_at: string | null;
}

interface Detalle {
  tarea: Tarea;
  subtareas: Tarea[];
  eventos: TareaEvento[];
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  bloqueada: 'Bloqueada',
  hecho: 'Hecho',
  cancelada: 'Cancelada',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 6,
  padding: '6px 10px', minHeight: 36, fontSize: 'var(--os-text-sm)', color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)', outline: 'none', boxSizing: 'border-box', width: '100%',
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function lineaCambio(campo: string, antes: unknown, despues: unknown): string {
  if (campo === 'estado') return `estado: ${antes ?? '—'} → ${despues ?? '—'}`;
  return `${campo}: ${antes ?? '—'} → ${despues ?? '—'}`;
}

interface Props {
  tareaId: string;
  onClose: () => void;
  /** Se llama tras cualquier cambio persistido, para que OSTareas.tsx
   * refresque su lista sin que este panel conozca su forma. */
  onCambiada: () => void;
}

export default function OSTareaDetalle({ tareaId, onClose, onCambiada }: Props) {
  const toast = useToast();
  const proyectos = useProyectosActivos();
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ifMatch, setIfMatch] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [subInput, setSubInput] = useState('');
  const focoRef = useRef(false);

  async function cargar(actualizaFormulario = true) {
    try {
      const res = await fetch(`/api/tareas/${tareaId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setIfMatch(data.tarea.updated_at);
      if (actualizaFormulario) {
        setDetalle(data);
      } else {
        // Poll: solo el feed y las subtareas se actualizan. Los campos del
        // formulario (title/notas/etc, controlados aparte) no se tocan aca.
        setDetalle((prev) => (prev ? { ...prev, eventos: data.eventos, subtareas: data.subtareas } : data));
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar(true);
    const intervalo = setInterval(() => {
      // Pausado si hay foco en un campo del formulario o un comentario sin
      // enviar: un refresco en ese momento arriesga pisar lo que se esta
      // escribiendo, o (peor, con el comentario) perderlo si el usuario lo
      // manda justo cuando el poll pisa el estado.
      if (focoRef.current || comentario.trim()) return;
      cargar(false);
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tareaId fija el ciclo de vida; comentario se lee via closure a proposito (ver el check de arriba).
  }, [tareaId]);

  async function guardarPatch(patch: Record<string, unknown>) {
    if (!detalle) return;
    try {
      const res = await fetch(`/api/tareas?id=${encodeURIComponent(tareaId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(ifMatch ? { 'If-Match': ifMatch } : {}) },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.show('Esta tarea cambio en otro lado. Se recargo con lo mas reciente.', 'error');
        await cargar(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || String(res.status));
      setDetalle((prev) => (prev ? { ...prev, tarea: data.tarea } : prev));
      setIfMatch(data.tarea.updated_at);
      onCambiada();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  async function enviarComentario() {
    const texto = comentario.trim();
    if (!texto || enviandoComentario) return;
    setEnviandoComentario(true);
    try {
      const res = await fetch('/api/tareas/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarea_id: tareaId, cuerpo: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setComentario('');
      await cargar(false);
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setEnviandoComentario(false);
    }
  }

  async function agregarSubtarea() {
    const titulo = subInput.trim();
    if (!titulo || !detalle) return;
    try {
      const res = await fetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, parent_id: tareaId, proyecto: detalle.tarea.proyecto, grupo: detalle.tarea.grupo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setSubInput('');
      await cargar(false);
      onCambiada();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  async function toggleSubtarea(sub: Tarea) {
    const nuevoEstado = sub.estado === 'hecho' ? 'pendiente' : 'hecho';
    try {
      const res = await fetch(`/api/tareas?id=${encodeURIComponent(sub.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await cargar(false);
      onCambiada();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  const sucio = comentario.trim().length > 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={loading ? 'Cargando...' : detalle?.tarea.titulo || 'Tarea'}
      side="right"
      maxWidth={480}
      confirmarCierre={async () => {
        if (!sucio) return true;
        return window.confirm('Tienes un comentario sin enviar. Cerrar de todos modos?');
      }}
    >
      {loading && <Spinner label="Cargando tarea..." />}
      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)' }}>Error: {error}</p>}

      {!loading && detalle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Titulo */}
          <input
            defaultValue={detalle.tarea.titulo}
            onFocus={() => { focoRef.current = true; }}
            onBlur={(e) => {
              focoRef.current = false;
              const v = e.target.value.trim();
              if (v && v !== detalle.tarea.titulo) guardarPatch({ titulo: v });
            }}
            style={{ ...inputStyle, fontSize: 'var(--os-text-base)', fontWeight: 700, fontFamily: 'var(--os-font-display)' }}
          />

          {/* Fila de metadatos: estado, prioridad, proyecto, deadline, tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              Estado
              <select value={detalle.tarea.estado} onChange={(e) => guardarPatch({ estado: e.target.value })} style={inputStyle}>
                {Object.entries(ESTADO_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              Prioridad
              <select value={detalle.tarea.prioridad || 'medium'} onChange={(e) => guardarPatch({ prioridad: e.target.value })} style={inputStyle}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              Proyecto
              <select value={detalle.tarea.proyecto ?? ''} onChange={(e) => guardarPatch({ proyecto: e.target.value || null })} style={inputStyle}>
                <option value="">Sin proyecto</option>
                {/* Une el valor actual con la lista de activos: si la tarea
                    pertenece a un proyecto pausado, sigue apareciendo aca. Sin
                    esto, abrir la tarea y guardar sin tocar el select le
                    borraria el proyecto. */}
                {detalle.tarea.proyecto && !proyectos.includes(detalle.tarea.proyecto) && (
                  <option value={detalle.tarea.proyecto}>{detalle.tarea.proyecto} (pausado)</option>
                )}
                {proyectos.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              Deadline
              <input type="date" defaultValue={detalle.tarea.deadline ?? ''} onBlur={(e) => guardarPatch({ deadline: e.target.value || null })} style={inputStyle} />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
            Notas
            <textarea
              defaultValue={detalle.tarea.notas ?? ''}
              onFocus={() => { focoRef.current = true; }}
              onBlur={(e) => { focoRef.current = false; guardarPatch({ notas: e.target.value.trim() || null }); }}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>

          {/* Subtareas */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Subtareas {detalle.subtareas.length > 0 && `(${detalle.subtareas.filter((s) => s.estado === 'hecho').length}/${detalle.subtareas.length})`}
            </p>
            {detalle.subtareas.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <button onClick={() => toggleSubtarea(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: s.estado === 'hecho' ? 'var(--os-champagne)' : 'var(--os-muted)' }}>
                    {s.estado === 'hecho' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </button>
                <span style={{ fontSize: 'var(--os-text-sm)', textDecoration: s.estado === 'hecho' ? 'line-through' : 'none', color: s.estado === 'hecho' ? 'var(--os-muted)' : 'var(--os-text)' }}>
                  {s.titulo}
                </span>
              </div>
            ))}
            <input
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSubtarea(); } }}
              placeholder="+ subtarea (Enter)"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </div>

          {/* Feed */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Actividad
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {detalle.eventos.length === 0 && (
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Sin actividad todavia.</p>
              )}
              {detalle.eventos.map((ev) => (
                <div key={ev.id} style={{ fontSize: 'var(--os-text-sm)', padding: '6px 8px', borderRadius: 6, background: ev.tipo === 'comentario' ? 'var(--os-fill-subtle)' : 'transparent' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <Badge tone={ev.autor_tipo === 'humano' ? 'accent' : 'neutral'}>{ev.autor || 'desconocido'}</Badge>
                    <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>{fechaCorta(ev.created_at)}{ev.editado_at ? ' (editado)' : ''}</span>
                  </div>
                  {/* Texto plano SIEMPRE: cuerpo puede venir de un tercero
                      transcrito por Hermes desde Telegram. Nada de HTML. */}
                  {ev.tipo === 'comentario' && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ev.cuerpo}</p>}
                  {ev.tipo === 'cambio' && ev.cambios && (
                    <p style={{ margin: 0, fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
                      {Object.entries(ev.cambios).map(([campo, { antes, despues }]) => lineaCambio(campo, antes, despues)).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                onFocus={() => { focoRef.current = true; }}
                onBlur={() => { focoRef.current = false; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }}
                placeholder="Escribe un comentario... (Enter para enviar)"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', flex: 1 }}
              />
              <Button size="sm" onClick={enviarComentario} disabled={!comentario.trim() || enviandoComentario}>
                {enviandoComentario ? '...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
