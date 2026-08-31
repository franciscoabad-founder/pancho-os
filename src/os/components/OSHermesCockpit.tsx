// OSHermesCockpit: Panel de control operativo para Hermes en Pancho OS.
// Permite:
// 1. Alternar entre perfiles (VPS, HomeLab, Laptop).
// 2. Ver conversaciones de Telegram y del OS (solo lectura de sesiones).
// 3. Cambiar modelos en caliente (DeepSeek, Claude, GPT-4o, Gemma).
// 4. Monitorear el kanban de tareas y ejecuciones del agente.
// Para conversar con Hermes, usar la pagina /chat.

import { useEffect, useState } from 'react';

interface SesionTaski {
  id: string;
  source: string;
  title: string | null;
  preview: string | null;
  messageCount: number;
  lastActive: number | null;
}

interface ModeloHermes {
  id: string;
  name: string;
  provider?: string;
}

interface PerfilHermes {
  id: string;
  nombre: string;
  tipo: 'vps' | 'homelab' | 'laptop';
  ubicacion: string;
  online: boolean;
  activo: boolean;
  modeloPrincipal: string;
  puerto: number;
}

interface TareaHermes {
  id: string;
  titulo: string;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'fallida';
  perfil: string;
  creadaEn: number | null;
  detalle?: string;
}

const SESION_OS_ID = 'pancho-os';

export default function OSHermesCockpit() {
  // Estado de perfiles
  const [perfiles, setPerfiles] = useState<PerfilHermes[]>([
    {
      id: 'vps-default',
      nombre: 'VPS (Canónico / Alfred)',
      tipo: 'vps',
      ubicacion: 'Hetzner (pancho-automations-01)',
      online: true,
      activo: true,
      modeloPrincipal: 'deepseek-v4-flash',
      puerto: 8642,
    },
    {
      id: 'homelab-local',
      nombre: 'HomeLab (Windows Pro / GPU)',
      tipo: 'homelab',
      ubicacion: 'HomeLab (Tailscale 100.127.201.2)',
      online: true,
      activo: false,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 9120,
    },
    {
      id: 'laptop-local',
      nombre: 'Laptop (Desarrollo)',
      tipo: 'laptop',
      ubicacion: 'Local (127.0.0.1 / Tailscale)',
      online: false,
      activo: false,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 9120,
    },
  ]);
  const [perfilActivo, setPerfilActivo] = useState('vps-default');

  // Estado de sesiones
  const [sesiones, setSesiones] = useState<SesionTaski[]>([
    { id: SESION_OS_ID, source: 'api_server', title: 'Taski (OS)', preview: null, messageCount: 0, lastActive: null },
  ]);
  const [sesionActual, setSesionActual] = useState(SESION_OS_ID);
  const [filtroSesion, setFiltroSesion] = useState('');

  // Estado de modelos
  const [modelos, setModelos] = useState<ModeloHermes[]>([]);
  const [modeloActual, setModeloActual] = useState('deepseek/deepseek-v4-flash');
  const [cambiandoModelo, setCambiandoModelo] = useState(false);

  // Estado de tareas / kanban
  const [tareas, setTareas] = useState<TareaHermes[]>([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);

  // Pestaña en movil
  const [pestanaMovil, setPestanaMovil] = useState<'sesiones' | 'kanban'>('sesiones');

  // Carga inicial
  useEffect(() => {
    void cargarPerfiles();
    void cargarModelos();
    void cargarSesiones();
    void cargarTareas();
  }, []);

  useEffect(() => {
    const perfil = perfiles.find((p) => p.id === perfilActivo);
    setModeloActual(perfil?.modeloPrincipal || 'deepseek/deepseek-v4-flash');
    if (perfilActivo === 'vps-default') return;
    void cargarModelos();
    void cargarSesiones();
    void cargarTareas();
  }, [perfilActivo]);

  async function cargarPerfiles() {
    try {
      const res = await fetch('/api/taski/perfiles');
      const data = await res.json();
      if (data.perfiles?.length) setPerfiles(data.perfiles);
    } catch {
      // ignore
    }
  }

  async function cargarModelos() {
    try {
      const res = await fetch(`/api/taski/modelos?profile_id=${encodeURIComponent(perfilActivo)}`);
      const data = await res.json();
      if (data.modelos?.length) {
        setModelos(data.modelos);
        const principal = perfiles.find((p) => p.id === perfilActivo)?.modeloPrincipal;
        const match = principal && data.modelos.find((m: ModeloHermes) => m.id === principal || m.id.includes(principal) || m.name === principal);
        if (match) setModeloActual(match.id);
      }
    } catch {
      // ignore
    }
  }

  async function cargarSesiones() {
    try {
      const res = await fetch(`/api/taski/sesiones?profile_id=${encodeURIComponent(perfilActivo)}`);
      const data = await res.json();
      if (data.sesiones?.length) setSesiones(data.sesiones);
    } catch {
      // ignore
    }
  }

  async function cargarTareas() {
    setCargandoTareas(true);
    try {
      const res = await fetch(`/api/taski/kanban?profile_id=${encodeURIComponent(perfilActivo)}`);
      const data = await res.json();
      if (data.tareas) setTareas(data.tareas);
    } catch {
      // ignore
    } finally {
      setCargandoTareas(false);
    }
  }

  function cambiarSesion(id: string) {
    setSesionActual(id);
  }

  async function cambiarModelo(nuevoModelo: string) {
    setModeloActual(nuevoModelo);
    setCambiandoModelo(true);
    try {
      await fetch('/api/taski/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: nuevoModelo, session_id: sesionActual, profile_id: perfilActivo }),
      });
    } catch {
      // ignore
    } finally {
      setCambiandoModelo(false);
    }
  }

  const sesionesFiltradas = sesiones.filter((s) => {
    if (!filtroSesion.trim()) return true;
    const q = filtroSesion.toLowerCase();
    const titulo = (s.title || '').toLowerCase();
    const id = s.id.toLowerCase();
    const preview = (s.preview || '').toLowerCase();
    return titulo.includes(q) || id.includes(q) || preview.includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── BARRA DE PERFILES ── */}
      <div className="os-card" style={{ padding: '0.875rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <p className="os-section-title" style={{ margin: 0 }}>Perfiles de Hermes</p>
            <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '2px 0 0' }}>
              Selecciona que nodo de Hermes recibe y ejecuta las operaciones.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {perfiles.map((p) => {
              const seleccionado = p.id === perfilActivo;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPerfilActivo(p.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 'var(--os-r-md, 8px)',
                    background: seleccionado ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                    border: seleccionado ? '1px solid var(--os-accent)' : '1px solid var(--os-line-soft)',
                    color: seleccionado ? 'var(--os-accent-light)' : 'var(--os-text)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: seleccionado ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: p.online ? '#22c55e' : 'var(--os-muted)',
                    }}
                  />
                  <span>{p.nombre}</span>
                  <span style={{ fontSize: 10, color: 'var(--os-muted)' }}>({p.ubicacion})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── BARRA DE CONTROL RAPIDO ── */}
      <div
        className="os-card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Selector de Modelo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--os-accent-light)' }}>
              psychology
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--os-text)' }}>Modelo:</span>
            <select
              value={modeloActual}
              disabled={cambiandoModelo}
              onChange={(e) => void cambiarModelo(e.target.value)}
              className="os-input"
              style={{
                fontSize: 12,
                padding: '4px 8px',
                height: 32,
                width: 'auto',
                minWidth: 200,
              }}
            >
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Badge de Sesion Actual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--os-muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              forum
            </span>
            <span>
              Sesion activa: <strong>{sesiones.find((s) => s.id === sesionActual)?.title || sesionActual}</strong>
            </span>
          </div>
        </div>

        {/* Botones de accion */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="os-btn"
            onClick={() => void cargarSesiones()}
            style={{ fontSize: 12, padding: '4px 10px', height: 32 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              refresh
            </span>
            Actualizar
          </button>
        </div>
      </div>

      {/* ── SELECTOR DE PESTANAS MOVIL ── */}
      <div
        className="os-mobile-tabs"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--os-line-soft)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setPestanaMovil('sesiones')}
          className={`os-btn ${pestanaMovil === 'sesiones' ? 'os-btn-primary' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
        >
          Sesiones ({sesiones.length})
        </button>
        <button
          type="button"
          onClick={() => setPestanaMovil('kanban')}
          className={`os-btn ${pestanaMovil === 'kanban' ? 'os-btn-primary' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
        >
          Kanban / Tareas
        </button>
      </div>

      {/* ── GRID PRINCIPAL DEL COCKPIT ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1rem',
          alignItems: 'start',
        }}
        className="os-cockpit-grid"
      >
        {/* COLUMNA 1: LISTA DE SESIONES */}
        <div
          className={`os-card os-cockpit-col ${pestanaMovil !== 'sesiones' ? 'os-hide-mobile' : ''}`}
          style={{
            padding: '0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxHeight: 'calc(100vh - 280px)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--os-muted)' }}>
              Conversaciones
            </span>
            <span style={{ fontSize: 11, color: 'var(--os-accent-light)' }}>{sesiones.length} activas</span>
          </div>

          <input
            type="text"
            className="os-input"
            placeholder="Buscar sesion o topic..."
            value={filtroSesion}
            onChange={(e) => setFiltroSesion(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
          />

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {sesionesFiltradas.map((s) => {
              const activa = s.id === sesionActual;
              return (
                <div
                  key={s.id}
                  onClick={() => cambiarSesion(s.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--os-r-md, 8px)',
                    background: activa ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                    border: activa ? '1px solid var(--os-accent)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: activa ? 600 : 500,
                        color: activa ? 'var(--os-accent-light)' : 'var(--os-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.title || (s.source === 'telegram' ? 'Telegram Topic' : s.id)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: s.source === 'telegram' ? 'rgba(56,189,248,0.15)' : 'var(--os-bg-sunken)',
                        color: s.source === 'telegram' ? '#38bdf8' : 'var(--os-muted)',
                      }}
                    >
                      {s.source}
                    </span>
                  </div>

                  {s.preview && (
                    <p
                      style={{
                        fontSize: 11,
                        color: 'var(--os-muted)',
                        margin: '3px 0 0',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.preview}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA 2: KANBAN Y OPERACIONES */}
        <div
          className={`os-card os-cockpit-col ${pestanaMovil !== 'kanban' ? 'os-hide-mobile' : ''}`}
          style={{
            padding: '0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxHeight: 'calc(100vh - 280px)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--os-muted)' }}>
              Pendientes & Jobs
            </span>
            <button
              type="button"
              onClick={() => void cargarTareas()}
              style={{ background: 'none', border: 'none', color: 'var(--os-accent-light)', cursor: 'pointer', fontSize: 11 }}
            >
              Recargar
            </button>
          </div>

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {cargandoTareas && <p style={{ fontSize: 12, color: 'var(--os-muted)' }}>Consultando jobs...</p>}

            {!cargandoTareas && tareas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--os-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, marginBottom: 4 }}>
                  task_alt
                </span>
                <p style={{ fontSize: 12, margin: 0 }}>No hay jobs en ejecución en este momento.</p>
              </div>
            )}

            {tareas.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--os-r-md, 8px)',
                  background: 'var(--os-fill-subtle)',
                  border: '1px solid var(--os-line-soft)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--os-text)' }}>{t.titulo}</span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: t.estado === 'en_progreso' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
                      color: t.estado === 'en_progreso' ? '#eab308' : '#22c55e',
                    }}
                  >
                    {t.estado}
                  </span>
                </div>
                {t.detalle && <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '4px 0 0' }}>{t.detalle}</p>}
              </div>
            ))}
          </div>

          {/* Capacidades activas */}
          <div style={{ borderTop: '1px solid var(--os-line-soft)', paddingTop: '0.75rem' }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--os-muted)', margin: '0 0 6px' }}>
              Capacidades Activas
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['Telegram', 'GBrain MCP', 'A2A Network', 'Calendar n8n', 'Gmail n8n', 'Terminal'].map((cap) => (
                <span
                  key={cap}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--os-fill-subtle)',
                    border: '1px solid var(--os-line-soft)',
                    color: 'var(--os-text-2)',
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .os-mobile-tabs { display: none; }
        @media (max-width: 1024px) {
          .os-cockpit-grid {
            grid-template-columns: 1fr !important;
          }
          .os-mobile-tabs {
            display: flex !important;
          }
          .os-hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
