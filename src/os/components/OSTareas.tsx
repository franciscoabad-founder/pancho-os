import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Spinner, ToastProvider, useConfirm, useToast } from './ui';
import { useProyectosActivos } from '../hooks/useProyectosActivos.ts';
import OSTareaDetalle from './OSTareaDetalle.tsx';

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
}

// Regla de color del OS: hecho = champagne, accion = accent, danger = #D4537E, nunca verde.
const PRIORIDAD_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#D4537E', bg: 'rgba(212,83,126,0.14)' },
  high:     { label: 'High',     color: 'var(--os-warn)', bg: 'rgba(180,83,9,0.12)' },
  medium:   { label: 'Medium',   color: 'var(--os-accent-light)', bg: 'rgba(107,122,232,0.16)' },
  low:      { label: 'Low',      color: 'var(--os-muted)', bg: 'rgba(107,114,128,0.16)' },
};

// 5 estados desde la Rebanada A (antes solo pendiente/en_progreso/hecho).
const ESTADO_META: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:   { label: 'Pendiente',   color: 'var(--os-text-2)', bg: 'var(--os-fill-subtle)' },
  en_progreso: { label: 'En progreso', color: 'var(--os-accent-light)', bg: 'rgba(107,122,232,0.16)' },
  bloqueada:   { label: 'Bloqueada',   color: '#D4537E', bg: 'rgba(212,83,126,0.14)' },
  hecho:       { label: 'Hecho',       color: 'var(--os-champagne)', bg: 'rgba(181,152,90,0.14)' },
  cancelada:   { label: 'Cancelada',   color: 'var(--os-muted)', bg: 'var(--os-fill-subtle)' },
};

const GRUPO_ACCENT: Record<string, string> = {
  'URGENTE ASAP': '#D4537E',
  'URGENTE!': 'var(--os-warn)',
  general: 'var(--os-accent)',
};

type Agrupacion = 'grupo' | 'proyecto' | 'fecha' | 'ninguna';
const AGRUPACION_CONFIG_KEY = 'tareas_agrupacion';
const AGRUPACION_LABEL: Record<Agrupacion, string> = {
  grupo: 'Urgencia',
  proyecto: 'Proyecto',
  fecha: 'Fecha',
  ninguna: 'Sin agrupar',
};

function estadoValue(estado: string) {
  return estado === 'en progreso' ? 'en_progreso' : (estado || 'pendiente');
}

function grupoRank(g: string) {
  if (g === 'URGENTE ASAP') return 0;
  if (g === 'URGENTE!') return 1;
  if (g === 'general') return 99;
  return 50;
}

function bucketFecha(t: Tarea, today: string): string {
  if (!t.deadline) return 'Sin fecha';
  if (t.deadline < today) return 'Vencidas';
  if (t.deadline === today) return 'Hoy';
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (t.deadline <= en7) return 'Esta semana';
  return 'Mas adelante';
}
const FECHA_RANK: Record<string, number> = { Vencidas: 0, Hoy: 1, 'Esta semana': 2, 'Mas adelante': 3, 'Sin fecha': 4 };

const selectStyle: React.CSSProperties = {
  background: 'var(--os-surface)',
  border: '1px solid var(--os-line)',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 'var(--os-text-xs)',
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
  fontSize: 'var(--os-text-sm)',
  color: 'var(--os-text)',
  fontFamily: 'var(--os-font-body)',
  outline: 'none',
  boxSizing: 'border-box',
};

function OSTareasInner() {
  const toast = useToast();
  const { confirm, sheet } = useConfirm();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const proyectos = useProyectosActivos();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({});
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [mostrarHechas, setMostrarHechas] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('grupo');

  // Alta rapida
  const [nTitulo, setNTitulo] = useState('');
  const [nProyecto, setNProyecto] = useState('');
  const [nDeadline, setNDeadline] = useState('');
  const [nPrioridad, setNPrioridad] = useState('medium');
  const [nGrupo, setNGrupo] = useState('general');
  const [nTipo, setNTipo] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/tareas');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setTareas(data.tareas ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Agrupacion configurable, recordada en os_config (misma mecanica que
  // bottom_nav): asi la eleccion de Pancho persiste entre dispositivos.
  useEffect(() => {
    fetch(`/api/config/${AGRUPACION_CONFIG_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        const v = data?.config?.value;
        if (v === 'grupo' || v === 'proyecto' || v === 'fecha' || v === 'ninguna') setAgrupacion(v);
      })
      .catch(() => null);
  }, []);

  function cambiarAgrupacion(v: Agrupacion) {
    setAgrupacion(v);
    fetch(`/api/config/${AGRUPACION_CONFIG_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: v }),
    }).catch(() => null);
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/tareas?id=${encodeURIComponent(id)}`, {
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
      title: 'Eliminar tarea',
      text: 'Esta accion no se puede deshacer. Se eliminan tambien sus subtareas.',
      confirmLabel: 'Eliminar',
      danger: true,
    }))) return;
    try {
      const res = await fetch(`/api/tareas?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  async function crear(body: Record<string, unknown>) {
    const res = await fetch('/api/tareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || String(res.status));
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nTitulo.trim() || busy) return;
    setBusy(true);
    try {
      await crear({
        titulo: nTitulo.trim(),
        proyecto: nProyecto.trim() || null,
        deadline: nDeadline || null,
        prioridad: nPrioridad,
        grupo: nGrupo.trim() || 'general',
        tipo: nTipo.trim() || null,
      });
      setNTitulo(''); setNProyecto(''); setNDeadline(''); setNTipo('');
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function agregarSubtarea(padre: Tarea) {
    const titulo = (subInputs[padre.id] || '').trim();
    if (!titulo) return;
    try {
      await crear({ titulo, parent_id: padre.id, grupo: padre.grupo || 'general', proyecto: padre.proyecto });
      setSubInputs((prev) => ({ ...prev, [padre.id]: '' }));
      setExpandidas((prev) => ({ ...prev, [padre.id]: true }));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  // Quick-add por grupo visible: crea la tarea con el contexto del grupo que
  // se esta mirando (grupo/proyecto segun la agrupacion activa), sin abrir el
  // formulario de alta de arriba.
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});
  async function agregarEnGrupo(nombreGrupo: string) {
    const titulo = (quickAdd[nombreGrupo] || '').trim();
    if (!titulo) return;
    try {
      const body: Record<string, unknown> = { titulo };
      if (agrupacion === 'grupo') body.grupo = nombreGrupo;
      else if (agrupacion === 'proyecto' && nombreGrupo !== 'Sin proyecto') body.proyecto = nombreGrupo;
      await crear(body);
      setQuickAdd((prev) => ({ ...prev, [nombreGrupo]: '' }));
      await load();
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  const { grupos, hijosPor } = useMemo(() => {
    const hijosPor: Record<string, Tarea[]> = {};
    const padres: Tarea[] = [];
    for (const t of tareas) {
      if (t.parent_id) {
        (hijosPor[t.parent_id] ??= []).push(t);
      } else {
        padres.push(t);
      }
    }
    for (const k of Object.keys(hijosPor)) {
      hijosPor[k].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.created_at.localeCompare(b.created_at));
    }
    const visibles = padres.filter((t) => mostrarHechas || estadoValue(t.estado) !== 'hecho' || (hijosPor[t.id] ?? []).some((h) => estadoValue(h.estado) !== 'hecho'));

    const today = new Date().toISOString().slice(0, 10);
    const claveDe = (t: Tarea): string => {
      if (agrupacion === 'proyecto') return t.proyecto || 'Sin proyecto';
      if (agrupacion === 'fecha') return bucketFecha(t, today);
      if (agrupacion === 'ninguna') return 'Todas';
      return t.grupo || 'general';
    };
    const rankDe = (g: string): number => {
      if (agrupacion === 'fecha') return FECHA_RANK[g] ?? 9;
      if (agrupacion === 'grupo') return grupoRank(g);
      return 50;
    };

    const porGrupo: Record<string, Tarea[]> = {};
    for (const t of visibles) {
      const g = claveDe(t);
      (porGrupo[g] ??= []).push(t);
    }
    const grupos = Object.keys(porGrupo)
      .sort((a, b) => rankDe(a) - rankDe(b) || a.localeCompare(b))
      .map((g) => ({
        nombre: g,
        items: porGrupo[g].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.deadline || '9999').localeCompare(b.deadline || '9999')),
      }));
    return { grupos, hijosPor };
  }, [tareas, mostrarHechas, agrupacion]);

  const pendientesCount = tareas.filter((t) => estadoValue(t.estado) !== 'hecho').length;

  function filaTarea(t: Tarea, esSub = false) {
    const est = estadoValue(t.estado);
    const isDone = est === 'hecho';
    const pr = PRIORIDAD_META[t.prioridad || 'medium'] ?? PRIORIDAD_META.medium;
    const em = ESTADO_META[est] ?? ESTADO_META.pendiente;
    const hijos = hijosPor[t.id] ?? [];
    const abierta = !!expandidas[t.id];
    const today = new Date().toISOString().slice(0, 10);
    const vencida = !!(t.deadline && t.deadline < today && !isDone);

    return (
      <div key={t.id}>
        <div
          className="wr-row"
          style={{ paddingLeft: esSub ? 34 : 0, opacity: isDone ? 0.55 : 1, cursor: 'pointer' }}
          onClick={() => setDetalleId(t.id)}
        >
          {/* Item */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {!esSub && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpandidas((prev) => ({ ...prev, [t.id]: !abierta })); }}
                title={abierta ? 'Colapsar subtareas' : 'Expandir subtareas'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: hijos.length ? 'var(--os-accent-light)' : 'var(--os-muted)', padding: 0, fontSize: 'var(--os-text-xs)', width: 16, flexShrink: 0 }}
              >
                {abierta ? '▾' : '▸'}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); patch(t.id, { estado: isDone ? 'pendiente' : 'hecho' }); }}
              title={isDone ? 'Reabrir' : 'Marcar hecha'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1, flexShrink: 0, display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: isDone ? 'var(--os-champagne)' : 'var(--os-muted)' }}>
                {isDone ? 'check_circle' : 'radio_button_unchecked'}
              </span>
            </button>
            <span
              title="Abrir detalle"
              style={{ fontSize: 'var(--os-text-sm)', color: isDone ? 'var(--os-muted)' : 'var(--os-text)', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {t.titulo}
            </span>
            {t.notas && <span title={t.notas} style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {t.notas}</span>}
            {!esSub && hijos.length > 0 && (
              <span className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', flexShrink: 0 }}>
                {hijos.filter((h) => estadoValue(h.estado) === 'hecho').length}/{hijos.length}
              </span>
            )}
          </div>

          {/* Due date: control real, no prompt */}
          <input
            type="date"
            value={t.deadline ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(t.id, { deadline: e.target.value || null })}
            style={{ ...selectStyle, color: vencida ? 'var(--os-error)' : t.deadline === today ? 'var(--os-warn)' : 'var(--os-muted)', padding: '3px 4px', fontFamily: 'var(--os-font-body)', fontWeight: 400 }}
          />

          {/* Prioridad */}
          <select
            value={t.prioridad || 'medium'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(t.id, { prioridad: e.target.value })}
            style={{ ...selectStyle, color: pr.color }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          {/* Proyecto */}
          <select
            value={t.proyecto ?? ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(t.id, { proyecto: e.target.value || null })}
            title="Cambiar proyecto"
            style={{ ...selectStyle, maxWidth: 130 }}
          >
            <option value="">+ proyecto</option>
            {t.proyecto && !proyectos.includes(t.proyecto) && <option value={t.proyecto}>{t.proyecto}</option>}
            {proyectos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Estado: inline, sin abrir el panel (lo que mas se usa por dia) */}
          <select
            value={est}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => patch(t.id, { estado: e.target.value })}
            style={{ ...selectStyle, color: em.color }}
          >
            {Object.entries(ESTADO_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => eliminar(t.id)} title="Eliminar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--os-muted)', padding: 4, lineHeight: 1, display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          </div>
        </div>

        {!esSub && abierta && (
          <div style={{ borderLeft: '2px solid var(--os-line-accent)', marginLeft: 7 }} onClick={(e) => e.stopPropagation()}>
            {hijos.map((h) => filaTarea(h, true))}
            <div style={{ display: 'flex', gap: 6, padding: '5px 0 7px 34px' }}>
              <input
                value={subInputs[t.id] || ''}
                onChange={(e) => setSubInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarSubtarea(t); } }}
                placeholder="+ subtarea (Enter para agregar)"
                style={{ ...inputStyle, flex: 1, fontSize: 'var(--os-text-xs)', padding: '4px 9px', minHeight: 32 }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .wr-row {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) 96px minmax(90px, 130px) minmax(70px, 100px) 110px 34px;
          gap: 10px;
          align-items: center;
          padding: 7px 10px;
          border-bottom: 1px solid var(--os-line-soft);
        }
        .wr-row:hover { background: var(--os-hover); }
        .wr-head {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) 96px minmax(90px, 130px) minmax(70px, 100px) 110px 34px;
          gap: 10px;
          padding: 4px 10px 6px;
          font-family: var(--os-font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--os-muted);
        }
        .wr-table { overflow-x: auto; }
        .wr-table-inner { min-width: 700px; }
      `}</style>

      {/* Alta rapida */}
      <form onSubmit={agregar} className="os-card-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
        <input value={nTitulo} onChange={(e) => setNTitulo(e.target.value)} placeholder="Titulo de la tarea *" required style={{ ...inputStyle, flex: 2, minWidth: 170 }} />
        <select value={nProyecto} onChange={(e) => setNProyecto(e.target.value)} style={{ ...selectStyle, minHeight: 36, flex: 1, minWidth: 100 }}><option value="">Proyecto</option>{proyectos.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <input type="date" value={nDeadline} onChange={(e) => setNDeadline(e.target.value)} style={inputStyle} />
        <select value={nPrioridad} onChange={(e) => setNPrioridad(e.target.value)} style={{ ...selectStyle, color: (PRIORIDAD_META[nPrioridad] ?? PRIORIDAD_META.medium).color, padding: '6px 8px', minHeight: 36 }}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input value={nGrupo} onChange={(e) => setNGrupo(e.target.value)} placeholder="Grupo (general)" list="wr-grupos" style={{ ...inputStyle, width: 140 }} />
        <datalist id="wr-grupos">
          <option value="URGENTE ASAP" />
          <option value="URGENTE!" />
          <option value="general" />
        </datalist>
        <input value={nTipo} onChange={(e) => setNTipo(e.target.value)} placeholder="Tipo" style={{ ...inputStyle, width: 100 }} />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? '...' : 'Agregar'}
        </Button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
        <p className="os-num" style={{ fontSize: 'var(--os-text-xs)', margin: 0 }}>{pendientesCount} pendientes</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Agrupar por</span>
          <select value={agrupacion} onChange={(e) => cambiarAgrupacion(e.target.value as Agrupacion)} style={selectStyle}>
            {Object.entries(AGRUPACION_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setMostrarHechas((v) => !v)}>
            {mostrarHechas ? 'Ocultar hechas' : 'Ver hechas'}
          </Button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-xs)', marginBottom: 10 }}>Error: {error}</p>}
      {loading && <Spinner label="Cargando tareas..." />}
      {!loading && !grupos.length && (
        <div className="os-card-2">
          <EmptyState
            icon="checklist"
            title="Sin tareas activas"
            text="El war room esta despejado. Crea la primera tarea con el formulario de arriba."
          />
        </div>
      )}

      {grupos.map(({ nombre, items }) => {
        const accent = GRUPO_ACCENT[nombre] ?? 'var(--os-accent-light)';
        const colapsado = !!colapsados[nombre];
        const abiertasCount = items.filter((t) => estadoValue(t.estado) !== 'hecho').length;
        return (
          <div key={nombre} className="os-card-2" style={{ padding: 0, marginBottom: '1rem', borderLeft: `3px solid ${accent}`, overflow: 'hidden' }}>
            <button
              onClick={() => setColapsados((prev) => ({ ...prev, [nombre]: !colapsado }))}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', minHeight: 36, textAlign: 'left' }}
            >
              <span style={{ color: accent, fontSize: 'var(--os-text-xs)' }}>{colapsado ? '▸' : '▾'}</span>
              <span style={{ fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>
                {nombre}
              </span>
              <span className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
                {abiertasCount} abiertas · {items.length} total
              </span>
            </button>
            {!colapsado && (
              <div className="wr-table">
                <div className="wr-table-inner">
                  <div className="wr-head">
                    <span>Item</span>
                    <span>Due date</span>
                    <span>Prioridad</span>
                    <span>Proyecto</span>
                    <span>Estado</span>
                    <span></span>
                  </div>
                  {items.map((t) => filaTarea(t))}
                  <div style={{ display: 'flex', gap: 6, padding: '6px 10px 9px' }}>
                    <input
                      value={quickAdd[nombre] || ''}
                      onChange={(e) => setQuickAdd((prev) => ({ ...prev, [nombre]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEnGrupo(nombre); } }}
                      placeholder="+ tarea en este grupo (Enter)"
                      style={{ ...inputStyle, flex: 1, fontSize: 'var(--os-text-xs)', padding: '4px 9px', minHeight: 32 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {sheet}
      {detalleId && (
        <OSTareaDetalle tareaId={detalleId} onClose={() => setDetalleId(null)} onCambiada={load} />
      )}
    </div>
  );
}

export default function OSTareas() {
  return (
    <ToastProvider>
      <OSTareasInner />
    </ToastProvider>
  );
}
