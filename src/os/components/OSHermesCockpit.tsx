// OSHermesCockpit: Centro de control operativo para Hermes en Pancho OS.
// Reemplaza a la app de escritorio de Hermes permitiendo:
// 1. Alternar entre perfiles (VPS, HomeLab, Laptop).
// 2. Gestionar conversaciones de Telegram y del OS.
// 3. Cambiar modelos en caliente (DeepSeek, Claude, GPT-4o, Gemma).
// 4. Dictado por voz nativo.
// 5. Monitorear el kanban de tareas y ejecuciones del agente.

import { useEffect, useRef, useState } from 'react';
import { useVoiceDictation } from '../hooks/useVoiceDictation.ts';

interface Turno {
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp?: number | null;
}

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

  // Estado de chat
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState('');

  // Estado de modelos
  const [modelos, setModelos] = useState<ModeloHermes[]>([]);
  const [modeloActual, setModeloActual] = useState('deepseek/deepseek-v4-flash');
  const [cambiandoModelo, setCambiandoModelo] = useState(false);

  // Estado de tareas / kanban
  const [tareas, setTareas] = useState<TareaHermes[]>([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);

  // Pestaña en movil
  const [pestanaMovil, setPestanaMovil] = useState<'chat' | 'sesiones' | 'kanban'>('chat');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hook de Dictado por Voz
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceDictation({
    lang: 'es-EC',
    onResult: (transcripcion) => {
      setTexto((prev) => (prev ? `${prev} ${transcripcion}` : transcripcion));
    },
  });

  // Carga inicial
  useEffect(() => {
    void cargarPerfiles();
    void cargarModelos();
    void cargarSesiones();
    void cargarTareas();
    void cargarHistorial(sesionActual);
  }, []);

  // Autoscroll en el chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [turnos, pensando]);

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
      const res = await fetch('/api/taski/modelos');
      const data = await res.json();
      if (data.modelos?.length) setModelos(data.modelos);
    } catch {
      // ignore
    }
  }

  async function cargarSesiones() {
    try {
      const res = await fetch('/api/taski/sesiones');
      const data = await res.json();
      if (data.sesiones?.length) setSesiones(data.sesiones);
    } catch {
      // ignore
    }
  }

  async function cargarTareas() {
    setCargandoTareas(true);
    try {
      const res = await fetch('/api/taski/kanban');
      const data = await res.json();
      if (data.tareas) setTareas(data.tareas);
    } catch {
      // ignore
    } finally {
      setCargandoTareas(false);
    }
  }

  async function cargarHistorial(sessionId: string) {
    setCargandoHistorial(true);
    setTurnos([]);
    try {
      const res = await fetch(`/api/taski?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data.mensajes) {
        setTurnos(data.mensajes);
      } else if (data.error) {
        setTurnos([{ role: 'error', content: `Error: ${data.error}` }]);
      }
    } catch {
      setTurnos([{ role: 'error', content: 'No se pudo cargar el historial.' }]);
    } finally {
      setCargandoHistorial(false);
    }
  }

  function cambiarSesion(id: string) {
    if (id === sesionActual || pensando) return;
    setSesionActual(id);
    void cargarHistorial(id);
    setPestanaMovil('chat');
  }

  async function cambiarModelo(nuevoModelo: string) {
    setModeloActual(nuevoModelo);
    setCambiandoModelo(true);
    try {
      await fetch('/api/taski/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: nuevoModelo, session_id: sesionActual }),
      });
    } catch {
      // ignore
    } finally {
      setCambiandoModelo(false);
    }
  }

  async function enviar() {
    const msg = texto.trim();
    if (!msg || pensando) return;
    setTexto('');
    setTurnos((prev) => [...prev, { role: 'user', content: msg, timestamp: Date.now() }]);
    setPensando(true);
    try {
      const res = await fetch('/api/taski', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sesionActual }),
      });
      const data = await res.json();
      if (data.error || !res.ok) {
        setTurnos((prev) => [...prev, { role: 'error', content: data.error ?? `Error HTTP ${res.status}` }]);
      } else {
        setTurnos((prev) => [...prev, { role: 'assistant', content: data.reply || '(sin respuesta)', timestamp: Date.now() }]);
      }
    } catch {
      setTurnos((prev) => [...prev, { role: 'error', content: 'Error de conexion con Hermes.' }]);
    } finally {
      setPensando(false);
      setTimeout(() => inputRef.current?.focus(), 60);
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
              disabled={cambiandoModelo || pensando}
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
            onClick={() => void cargarHistorial(sesionActual)}
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
          onClick={() => setPestanaMovil('chat')}
          className={`os-btn ${pestanaMovil === 'chat' ? 'os-btn-primary' : ''}`}
          style={{ flex: 1, fontSize: 12 }}
        >
          Chat & Terminal
        </button>
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
          gridTemplateColumns: '280px 1fr 300px',
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

        {/* COLUMNA 2: CONSOLA DE CHAT Y COMANDOS */}
        <div
          className={`os-card os-cockpit-col ${pestanaMovil !== 'chat' ? 'os-hide-mobile' : ''}`}
          style={{
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 280px)',
            minHeight: 520,
            overflow: 'hidden',
          }}
        >
          {/* Header de la conversacion */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--os-line-soft)',
              background: 'var(--os-bg-sunken)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text)' }}>
                {sesiones.find((s) => s.id === sesionActual)?.title || 'Taski OS'}
              </span>
              <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: 0 }}>
                ID: {sesionActual} | {turnos.length} mensajes cargados
              </p>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Conectado
            </span>
          </div>

          {/* Historial de Mensajes */}
          <div
            ref={chatScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {cargandoHistorial && !turnos.length && (
              <p style={{ margin: 'auto', color: 'var(--os-muted)', fontSize: 13 }}>Cargando conversación...</p>
            )}

            {!cargandoHistorial && !turnos.length && (
              <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 360 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--os-accent-light)', marginBottom: 8 }}>
                  smart_toy
                </span>
                <p style={{ fontSize: 13, color: 'var(--os-text-2)', margin: '0 0 6px' }}>
                  Canal operativo de Hermes listo.
                </p>
                <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>
                  Escribe una instrucción, consulta el brain o dicta una orden por voz.
                </p>
              </div>
            )}

            {turnos.map((t, idx) => {
              const esUser = t.role === 'user';
              const esError = t.role === 'error';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: esUser ? 'flex-end' : 'flex-start',
                    maxWidth: esUser ? '80%' : '88%',
                    background: esUser ? 'var(--os-accent)' : esError ? 'rgba(239,68,68,0.1)' : 'var(--os-fill-subtle)',
                    border: esUser ? 'none' : esError ? '1px solid var(--os-error)' : '1px solid var(--os-line-soft)',
                    color: esUser ? '#fff' : esError ? 'var(--os-error)' : 'var(--os-text)',
                    padding: '10px 14px',
                    borderRadius: esUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {t.content}
                </div>
              );
            })}

            {pensando && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--os-muted)', fontSize: 12 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '2px solid var(--os-line)',
                    borderTopColor: 'var(--os-accent)',
                    animation: 'taski-spin 0.8s linear infinite',
                  }}
                />
                Hermes está razonando y ejecutando...
              </div>
            )}
          </div>

          {/* Caja de Input */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--os-line-soft)',
              background: 'var(--os-bg-sunken)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={texto}
              disabled={pensando}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              placeholder="Escribe una orden para Hermes (Enter para enviar, Shift+Enter para nueva linea)..."
              style={{
                flex: 1,
                resize: 'none',
                background: 'var(--os-fill-subtle)',
                border: '1px solid var(--os-line)',
                borderRadius: 'var(--os-r-md, 8px)',
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--os-text)',
                outline: 'none',
                fontFamily: 'var(--os-font-body)',
              }}
            />

            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={pensando}
                title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--os-r-md, 8px)',
                  background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'var(--os-fill-subtle)',
                  color: isListening ? 'var(--os-error, #ef4444)' : 'var(--os-muted)',
                  border: isListening ? '1px solid var(--os-error, #ef4444)' : '1px solid var(--os-line-soft)',
                  cursor: pensando ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 20,
                    animation: isListening ? 'os-pulse 1.2s infinite' : 'none',
                  }}
                >
                  {isListening ? 'mic' : 'mic_none'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void enviar()}
              disabled={pensando || !texto.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--os-r-md, 8px)',
                background: pensando || !texto.trim() ? 'var(--os-fill-subtle)' : 'var(--os-accent)',
                color: pensando || !texto.trim() ? 'var(--os-muted)' : '#fff',
                border: 'none',
                cursor: pensando || !texto.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                send
              </span>
            </button>
          </div>
        </div>

        {/* COLUMNA 3: KANBAN Y OPERACIONES */}
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
        @keyframes taski-spin { to { transform: rotate(360deg); } }
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
