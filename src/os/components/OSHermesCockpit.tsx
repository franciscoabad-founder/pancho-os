// OSHermesCockpit: Panel de control operativo para Hermes en Pancho OS.
// Permite:
// 1. Alternar entre perfiles (VPS, HomeLab, Laptop).
// 2. Ver conversaciones de Telegram y del OS (solo lectura de sesiones).
// 3. Cambiar el modelo de la sesion elegida, con el catalogo real de Hermes.
// 4. Monitorear el kanban de tareas y ejecuciones del agente.
// Para conversar con Hermes, usar la pagina /chat.

import { useEffect, useState } from 'react';
import { etiquetaSesion, nombreSesion, tooltipSesion, SESION_OS_ID } from '../lib/sesiones.ts';

type OrigenSesion = 'telegram' | 'os';
type FiltroOrigen = OrigenSesion | 'todas';

interface SesionTaski {
  id: string;
  source: string;
  origen: OrigenSesion;
  title: string | null;
  preview: string | null;
  messageCount: number;
  /** Epoch en milisegundos, ya normalizado por el server. */
  lastActive: number | null;
  alias?: boolean;
  tituloHermes?: string | null;
}

interface ModeloHermes {
  id: string;
  name: string;
  provider?: string;
  description?: string;
}

interface PerfilHermes {
  id: string;
  nombre: string;
  tipo: 'vps' | 'homelab' | 'laptop';
  ubicacion: string;
  /** El health check contesto. */
  online: boolean;
  /** Se puede seleccionar. Derivado de online por el server, ya no es fijo. */
  activo: boolean;
  /** Por que no esta disponible; va al tooltip. null = operativo. */
  motivo: string | null;
  configurado: boolean;
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

export default function OSHermesCockpit() {
  // Estado de perfiles
  const [perfiles, setPerfiles] = useState<PerfilHermes[]>([
    {
      id: 'vps-default',
      nombre: 'VPS (Canónico / Alfred)',
      tipo: 'vps',
      ubicacion: 'Hetzner (pancho-automations-01)',
      online: false,
      activo: false,
      motivo: 'Consultando estado...',
      configurado: true,
      modeloPrincipal: 'deepseek-v4-flash',
      puerto: 8642,
    },
    {
      id: 'homelab-local',
      nombre: 'HomeLab (Windows Pro / GPU)',
      tipo: 'homelab',
      ubicacion: 'HomeLab (Tailscale 100.127.201.2)',
      online: false,
      activo: false,
      motivo: 'Consultando estado...',
      configurado: true,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 8642,
    },
    {
      id: 'laptop-local',
      nombre: 'Laptop (Desarrollo)',
      tipo: 'laptop',
      ubicacion: 'Laptop (Tailscale 100.106.81.110)',
      online: false,
      activo: false,
      motivo: 'Consultando estado...',
      configurado: true,
      modeloPrincipal: 'gemma-4-uncensored',
      puerto: 8642,
    },
  ]);
  const [perfilActivo, setPerfilActivo] = useState('vps-default');

  // Estado de sesiones
  const [sesiones, setSesiones] = useState<SesionTaski[]>([
    { id: SESION_OS_ID, source: 'api_server', origen: 'os', title: 'Taski (OS)', preview: null, messageCount: 0, lastActive: null },
  ]);
  const [sesionActual, setSesionActual] = useState(SESION_OS_ID);
  const [filtroSesion, setFiltroSesion] = useState('');
  // Pestanas Telegram / OS / Todas. Por defecto Todas, ordenado por ultima
  // actividad: antes solo se veian las de Telegram y las de /chat no existian
  // para esta pantalla.
  const [origenSesion, setOrigenSesion] = useState<FiltroOrigen>('todas');
  // Renombrado inline: id de la sesion en edicion y el texto del input.
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [avisoSesiones, setAvisoSesiones] = useState<string | null>(null);

  // Estado de modelos
  const [modelos, setModelos] = useState<ModeloHermes[]>([]);
  const [modeloActual, setModeloActual] = useState('');
  const [cambiandoModelo, setCambiandoModelo] = useState(false);
  // Aviso discreto cuando el catalogo viene degradado o el cambio se rechaza.
  const [avisoModelos, setAvisoModelos] = useState<string | null>(null);

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

  // Cambiar de perfil recarga TODO lo que depende del nodo. Antes esto se
  // saltaba cuando el perfil era el VPS (`if (perfilActivo === 'vps-default')
  // return`), asi que volver al VPS dejaba en pantalla los datos del otro nodo.
  useEffect(() => {
    void cargarModelos();
    void cargarSesiones();
    void cargarTareas();
  }, [perfilActivo]);

  // El modelo se bloquea por sesion: al cambiar de conversacion hay que
  // volver a preguntar cual tiene activo.
  useEffect(() => {
    void cargarModelos();
  }, [sesionActual]);

  useEffect(() => {
    void cargarSesiones();
  }, [origenSesion]);

  async function cargarPerfiles() {
    try {
      const res = await fetch('/api/taski/perfiles');
      const data = await res.json();
      if (data.perfiles?.length) setPerfiles(data.perfiles);
    } catch {
      // ignore
    }
  }

  // Catalogo real de Hermes. El server intenta /api/model/options (inventario
  // de proveedores) y solo cae a /v1/models o al set de referencia si eso
  // falla; `aviso` explica la degradacion en la UI en vez de esconderla.
  // `modeloActivo` sale del campo `model` de la sesion, no de un string fijo.
  async function cargarModelos() {
    try {
      const res = await fetch(
        `/api/taski/modelos?profile_id=${encodeURIComponent(perfilActivo)}&session_id=${encodeURIComponent(sesionActual)}`,
      );
      const data = await res.json();
      if (data.modelos?.length) setModelos(data.modelos);
      setAvisoModelos(data.aviso ?? data.error ?? null);
      setModeloActual(data.modeloActivo ?? '');
    } catch {
      setAvisoModelos('No se pudo consultar el catalogo de modelos de Hermes.');
    }
  }

  async function cargarSesiones() {
    try {
      const res = await fetch(
        `/api/taski/sesiones?profile_id=${encodeURIComponent(perfilActivo)}&origen=${origenSesion}`,
      );
      const data = await res.json();
      if (data.error) {
        setAvisoSesiones(String(data.error));
        return;
      }
      setAvisoSesiones(null);
      setSesiones(data.sesiones ?? []);
    } catch {
      setAvisoSesiones('No se pudo consultar las conversaciones de Hermes.');
    }
  }

  // Renombrar: el server intenta PATCH /api/sessions/{id} en Hermes y, pase o
  // no pase, guarda el alias en la base del OS y lo muestra por encima del
  // titulo que invento el auto-titulador.
  async function guardarNombre(sessionId: string) {
    const titulo = nombreNuevo.trim();
    if (!titulo) return;
    setGuardandoNombre(true);
    try {
      const res = await fetch('/api/taski/sesiones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, titulo, profile_id: perfilActivo }),
      });
      const data = (await res.json()) as { error?: string; sincronizado_hermes?: boolean };
      if (!res.ok) {
        setAvisoSesiones(`No se pudo renombrar: ${data.error ?? `HTTP ${res.status}`}`);
        return;
      }
      setAvisoSesiones(
        data.sincronizado_hermes ? null : 'Nombre guardado solo en el OS: Hermes no acepto el cambio de titulo.',
      );
      setRenombrandoId(null);
      await cargarSesiones();
    } catch {
      setAvisoSesiones('No se pudo renombrar: Hermes no respondio.');
    } finally {
      setGuardandoNombre(false);
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

  // POST /api/sessions/{id}/model: el cambio aplica A LA SESION ELEGIDA, no
  // globalmente. Un fallo se muestra y se revierte el selector, en vez de
  // quedarse mostrando un modelo que Hermes nunca acepto.
  async function cambiarModelo(nuevoModelo: string) {
    const anterior = modeloActual;
    setModeloActual(nuevoModelo);
    setCambiandoModelo(true);
    try {
      const res = await fetch('/api/taski/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: nuevoModelo,
          provider: modelos.find((m) => m.id === nuevoModelo)?.provider,
          session_id: sesionActual,
          profile_id: perfilActivo,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setModeloActual(anterior);
        setAvisoModelos(`No se pudo cambiar el modelo: ${data.error ?? `HTTP ${res.status}`}`);
      } else {
        setAvisoModelos(null);
      }
    } catch {
      setModeloActual(anterior);
      setAvisoModelos('No se pudo cambiar el modelo: Hermes no respondio.');
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
            {/* Antes HomeLab y Laptop tenian activo:false escrito a mano en
                taski.handlers.ts, asi que salian apagados pasara lo que
                pasara. Ahora `activo` se deriva del health check real: verde
                vivo = seleccionable, gris = no alcanzable, y el tooltip dice
                exactamente por que. */}
            {perfiles.map((p) => {
              const seleccionado = p.id === perfilActivo;
              const disponible = p.activo;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!disponible}
                  title={p.motivo ?? `${p.nombre} — ${p.ubicacion}, api_server ${p.puerto}. Disponible.`}
                  aria-disabled={!disponible}
                  onClick={() => disponible && setPerfilActivo(p.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 'var(--os-r-md, 8px)',
                    background: seleccionado ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                    border: seleccionado ? '1px solid var(--os-accent)' : '1px solid var(--os-line-soft)',
                    color: seleccionado ? 'var(--os-accent-light)' : 'var(--os-text)',
                    cursor: disponible ? 'pointer' : 'not-allowed',
                    opacity: disponible ? 1 : 0.55,
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
                      boxShadow: p.online ? '0 0 6px rgba(34,197,94,0.8)' : 'none',
                    }}
                  />
                  <span>{p.nombre}</span>
                  <span style={{ fontSize: 10, color: 'var(--os-muted)' }}>
                    {p.online ? `(${p.ubicacion})` : p.configurado ? '(sin respuesta)' : '(sin configurar)'}
                  </span>
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
              {/* Sin modelo bloqueado, Hermes usa el del gateway. Se dice, en
                  vez de preseleccionar uno al azar. */}
              {!modeloActual && <option value="">Por defecto del perfil</option>}
              {/* Modelo activo que no esta en el catalogo: se muestra igual. */}
              {modeloActual && !modelos.some((m) => m.id === modeloActual) && (
                <option value={modeloActual}>{modeloActual} (activo)</option>
              )}
              {modelos.map((m) => (
                <option key={m.id} value={m.id} title={m.description}>
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
              Sesion activa:{' '}
              <strong>
                {(() => {
                  const s = sesiones.find((x) => x.id === sesionActual);
                  return s ? etiquetaSesion(s) : sesionActual;
                })()}
              </strong>
            </span>
          </div>

          {/* Aviso discreto de modelos: catalogo degradado o cambio rechazado. */}
          {avisoModelos && (
            <span
              title={avisoModelos}
              style={{
                fontSize: 11,
                color: 'var(--os-warning, #b45309)',
                maxWidth: 380,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {avisoModelos}
            </span>
          )}
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

          {/* Pestanas de origen: las conversaciones de /chat (os-chat-*) ya no
              quedan fuera de esta lista. Por defecto Todas. */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['todas', 'telegram', 'os'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setOrigenSesion(op)}
                title={
                  op === 'telegram'
                    ? 'Chats y topics de Telegram atendidos por Hermes'
                    : op === 'os'
                      ? 'Conversaciones nacidas en el OS (/chat y la burbuja Taski)'
                      : 'Todas, ordenadas por ultima actividad'
                }
                style={{
                  flex: 1,
                  padding: '3px 6px',
                  fontSize: 11,
                  borderRadius: 'var(--os-r-md, 8px)',
                  cursor: 'pointer',
                  background: origenSesion === op ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                  border: origenSesion === op ? '1px solid var(--os-accent)' : '1px solid var(--os-line-soft)',
                  color: origenSesion === op ? 'var(--os-accent-light)' : 'var(--os-text-2, var(--os-muted))',
                }}
              >
                {op === 'todas' ? 'Todas' : op === 'telegram' ? 'Telegram' : 'OS'}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="os-input"
            placeholder="Buscar sesion o topic..."
            value={filtroSesion}
            onChange={(e) => setFiltroSesion(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
          />

          {avisoSesiones && (
            <p style={{ fontSize: 11, color: 'var(--os-warning, #b45309)', margin: 0 }} title={avisoSesiones}>
              {avisoSesiones}
            </p>
          )}

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            {sesionesFiltradas.map((s) => {
              const activa = s.id === sesionActual;
              return (
                <div
                  key={s.id}
                  onClick={() => cambiarSesion(s.id)}
                  title={tooltipSesion(s)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--os-r-md, 8px)',
                    background: activa ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                    border: activa ? '1px solid var(--os-accent)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {renombrandoId === s.id ? (
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        className="os-input"
                        value={nombreNuevo}
                        disabled={guardandoNombre}
                        onChange={(e) => setNombreNuevo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void guardarNombre(s.id);
                          if (e.key === 'Escape') setRenombrandoId(null);
                        }}
                        placeholder="Nombre de la conversacion"
                        style={{ fontSize: 12, padding: '2px 6px', height: 26, flex: 1 }}
                      />
                      <button
                        type="button"
                        className="os-btn"
                        disabled={guardandoNombre}
                        onClick={() => void guardarNombre(s.id)}
                        style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        className="os-btn"
                        onClick={() => setRenombrandoId(null)}
                        style={{ fontSize: 11, padding: '2px 8px', height: 26 }}
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      {/* Nombre y fecha juntos; el conteo va en su propio chip
                          porque message_count NO son mensajes sin leer. */}
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
                        {etiquetaSesion(s)}
                      </span>
                      <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                        <span
                          title={`${s.messageCount} mensajes acumulados (incluye turnos de herramientas)`}
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'var(--os-bg-sunken)',
                            color: 'var(--os-muted)',
                          }}
                        >
                          {s.messageCount}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: s.origen === 'telegram' ? 'rgba(56,189,248,0.15)' : 'var(--os-bg-sunken)',
                            color: s.origen === 'telegram' ? '#38bdf8' : 'var(--os-muted)',
                          }}
                        >
                          {s.origen === 'telegram' ? 'Telegram' : 'OS'}
                        </span>
                        <button
                          type="button"
                          title="Renombrar esta conversacion"
                          aria-label={`Renombrar ${nombreSesion(s)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenombrandoId(s.id);
                            setNombreNuevo(nombreSesion(s));
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--os-muted)',
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                            edit
                          </span>
                        </button>
                      </span>
                    </div>
                  )}

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
