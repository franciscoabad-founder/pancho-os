// Chat soberano del OS: experiencia diaria tipo Telegram contra Hermes.
// Implementa os-chat-telegram-soberano (brain): hilo lineal persistido en el
// OS, envio async (POST devuelve 202 con el run) y polling del hilo hasta ver
// la respuesta final. Sin streaming crudo: estados simples + respuesta.
//
// Callers: src/routes/chat.tsx. API: /api/chat y /api/chat/:id.
// El Cockpit (/hermes) sigue siendo la vista power user; esto es la diaria.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDesktop,
  fsReadFile,
  ollamaStatus,
  flowHealth,
  flowStartRecording,
  flowStopRecording,
  flowErrorTexto,
  type OllamaStatus,
} from '../../lib/desktopBridge.ts';

interface Conversacion {
  id: string;
  titulo: string;
  perfil: string;
  updated_at: string;
}

interface Mensaje {
  id: string;
  rol: 'user' | 'assistant' | 'sistema';
  contenido: string;
  created_at: string;
}

interface Run {
  id: string;
  estado: 'pendiente' | 'trabajando' | 'completado' | 'fallido';
  error: string | null;
  iniciado_at: string;
}

// Sesiones de Telegram que Hermes ya guarda en el VPS. Vista de solo lectura:
// no hay envio, no hay polling, solo se listan y se leen. El campo de datos
// es role/content/timestamp, distinto de rol/contenido/created_at del OS.
interface TelegramSesion {
  id: string;
  source: string;
  title: string | null;
  preview: string | null;
  messageCount: number;
  lastActive: string;
}

interface TelegramMensaje {
  role: 'user' | 'assistant' | 'sistema';
  content: string;
  timestamp: string;
}

const POLL_MS = 3000;

// Cada conversacion elige que Hermes la atiende. El del VPS tiene Telegram,
// memoria canonica y n8n; el de la laptop trabaja con el terminal y los
// archivos de la laptop; el del HomeLab con la GPU local.
const PERFILES: Array<{ id: string; etiqueta: string }> = [
  { id: 'vps-default', etiqueta: 'Hermes VPS' },
  { id: 'laptop-local', etiqueta: 'Hermes Laptop' },
  { id: 'homelab-local', etiqueta: 'Hermes HomeLab' },
];

function etiquetaPerfil(id: string): string {
  return PERFILES.find((p) => p.id === id)?.etiqueta ?? id;
}

function horaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function OSChat() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [runActivo, setRunActivo] = useState<Run | null>(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 'os' = conversacion soberana editable. 'telegram-readonly' = viendo un
  // hilo de Telegram que Hermes ya guardo en el VPS, sin input ni polling.
  const [modo, setModo] = useState<'os' | 'telegram-readonly'>('os');
  const [telegramAbierto, setTelegramAbierto] = useState(false);
  const [telegramSesiones, setTelegramSesiones] = useState<TelegramSesion[]>([]);
  const [telegramCargandoLista, setTelegramCargandoLista] = useState(false);
  const [telegramActivaId, setTelegramActivaId] = useState<string | null>(null);
  const [telegramMensajes, setTelegramMensajes] = useState<TelegramMensaje[]>([]);
  const [telegramCargandoHilo, setTelegramCargandoHilo] = useState(false);

  // --- Bridge nativo (solo app de escritorio, Tauri) -----------------------
  const desktop = isDesktop();
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [flowMensaje, setFlowMensaje] = useState<string | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let vivo = true;
    void ollamaStatus().then((s) => {
      if (vivo) setOllama(s);
    });
    return () => {
      vivo = false;
    };
  }, [desktop]);

  const adjuntarArchivo = useCallback(async () => {
    const ruta = window.prompt('Ruta del archivo local a adjuntar:');
    if (!ruta) return;
    const r = await fsReadFile(ruta);
    if (!r.ok) {
      setError(`No se pudo leer el archivo: ${r.error.mensaje}`);
      return;
    }
    setTexto((prev) => `Archivo ${ruta}:\n\n${r.data.content}\n\n${prev}`);
  }, []);

  // NOTA: Flow graba reuniones completas (meeting_id), no dictado corto a
  // texto. flow.rs y desktopBridge.ts no exponen un endpoint de
  // dictado-a-texto apto para inyectar en este input, asi que el boton se
  // limita a iniciar/parar una grabacion de reunion con feedback de estado.
  // El dictado-a-input queda pendiente hasta que Flow (u otro comando Rust)
  // exponga eso.
  const alternarGrabacion = useCallback(async () => {
    if (flowBusy) return;
    setFlowBusy(true);
    setFlowMensaje(null);
    try {
      if (!grabando) {
        const salud = await flowHealth();
        if (!salud.ok) {
          setFlowMensaje(flowErrorTexto(salud.error));
          return;
        }
        const inicio = await flowStartRecording();
        if (!inicio.ok) {
          setFlowMensaje(flowErrorTexto(inicio.error));
          return;
        }
        setMeetingId(inicio.data.meeting_id);
        setGrabando(true);
        setFlowMensaje('Grabando reunion en Flow...');
      } else if (meetingId != null) {
        const fin = await flowStopRecording(meetingId);
        if (!fin.ok) {
          setFlowMensaje(flowErrorTexto(fin.error));
          return;
        }
        setGrabando(false);
        setMeetingId(null);
        setFlowMensaje('Grabacion detenida.');
      }
    } finally {
      setFlowBusy(false);
    }
  }, [flowBusy, grabando, meetingId]);

  const cargarConversaciones = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lista: Conversacion[] = data.conversaciones ?? [];
      setConversaciones(lista);
      return lista;
    } catch (e) {
      setError(`No se pudo cargar la lista: ${String(e)}`);
      return [];
    }
  }, []);

  const cargarHilo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMensajes(data.mensajes ?? []);
      setRunActivo(data.runActivo ?? null);
      setError(null);
    } catch (e) {
      setError(`No se pudo cargar el hilo: ${String(e)}`);
    }
  }, []);

  const cargarSesionesTelegram = useCallback(async () => {
    setTelegramCargandoLista(true);
    try {
      const res = await fetch('/api/taski/sesiones?profile_id=vps-default');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lista: TelegramSesion[] = (data.sesiones ?? []).filter(
        (s: TelegramSesion) => s.source === 'telegram',
      );
      lista.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
      setTelegramSesiones(lista);
    } catch (e) {
      setError(`No se pudo cargar Telegram: ${String(e)}`);
    } finally {
      setTelegramCargandoLista(false);
    }
  }, []);

  const abrirHiloTelegram = useCallback(async (id: string) => {
    setModo('telegram-readonly');
    setTelegramActivaId(id);
    setTelegramCargandoHilo(true);
    setError(null);
    try {
      const res = await fetch(`/api/taski?session_id=${encodeURIComponent(id)}&profile_id=vps-default`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTelegramMensajes(data.mensajes ?? []);
    } catch (e) {
      setError(`No se pudo cargar el hilo de Telegram: ${String(e)}`);
    } finally {
      setTelegramCargandoHilo(false);
    }
  }, []);

  // Arranque: lista + abrir la mas reciente (o crear la primera).
  useEffect(() => {
    void (async () => {
      const lista = await cargarConversaciones();
      if (lista.length > 0) {
        setActivaId(lista[0].id);
      }
    })();
  }, [cargarConversaciones]);

  useEffect(() => {
    if (activaId) void cargarHilo(activaId);
  }, [activaId, cargarHilo]);

  // Polling solo mientras hay un run activo: asi el hilo en reposo no gasta red.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (modo === 'os' && runActivo && activaId) {
      pollRef.current = setInterval(() => void cargarHilo(activaId), POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [modo, runActivo, activaId, cargarHilo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, runActivo?.estado, telegramMensajes.length]);

  const [perfilNuevo, setPerfilNuevo] = useState('vps-default');

  async function nuevaConversacion() {
    setCargando(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: perfilNuevo }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await cargarConversaciones();
      setModo('os');
      setActivaId(data.conversacion.id);
      setMensajes([]);
      setRunActivo(null);
    } catch (e) {
      setError(`No se pudo crear la conversacion: ${String(e)}`);
    } finally {
      setCargando(false);
    }
  }

  async function enviar() {
    const contenido = texto.trim();
    if (!contenido || !activaId || runActivo) return;
    setTexto('');
    setError(null);
    // Optimista: el mensaje aparece ya, como en Telegram.
    setMensajes((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, rol: 'user', contenido, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/chat/${activaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRunActivo(data.run);
      void cargarConversaciones();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const segundosTrabajando = runActivo
    ? Math.max(0, Math.round((Date.now() - new Date(runActivo.iniciado_at).getTime()) / 1000))
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: '1rem', minHeight: '70vh' }}>
      {/* Lista de conversaciones */}
      <div className="os-card-2" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select
          value={perfilNuevo}
          onChange={(e) => setPerfilNuevo(e.target.value)}
          className="os-input"
          style={{ fontSize: 12 }}
          title="Que Hermes atiende la conversacion nueva"
        >
          {PERFILES.map((p) => (
            <option key={p.id} value={p.id}>{p.etiqueta}</option>
          ))}
        </select>
        <button type="button" className="os-btn os-btn-primary" onClick={() => void nuevaConversacion()} disabled={cargando}>
          Nueva conversacion
        </button>
        {conversaciones.map((c) => (
          <button
            key={c.id}
            type="button"
            className="os-btn"
            onClick={() => {
              setModo('os');
              setActivaId(c.id);
            }}
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              fontSize: 12,
              background: modo === 'os' && c.id === activaId ? 'var(--os-fill-subtle)' : undefined,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
            title={c.titulo}
          >
            {c.titulo}
          </button>
        ))}

        {/* Seccion colapsable de solo lectura: hilos que Hermes ya guardo de Telegram */}
        <button
          type="button"
          className="os-btn"
          onClick={() => {
            const abrir = !telegramAbierto;
            setTelegramAbierto(abrir);
            if (abrir && telegramSesiones.length === 0) void cargarSesionesTelegram();
          }}
          style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}
        >
          <span>Telegram</span>
          <span>{telegramAbierto ? '▾' : '▸'}</span>
        </button>
        {telegramAbierto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {telegramCargandoLista && (
              <span style={{ fontSize: 11, color: 'var(--os-muted)', padding: '2px 6px' }}>Cargando...</span>
            )}
            {!telegramCargandoLista && telegramSesiones.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--os-muted)', padding: '2px 6px' }}>Sin hilos de Telegram.</span>
            )}
            {telegramSesiones.map((s) => (
              <button
                key={s.id}
                type="button"
                className="os-btn"
                onClick={() => void abrirHiloTelegram(s.id)}
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  fontSize: 11,
                  background: modo === 'telegram-readonly' && s.id === telegramActivaId ? 'var(--os-fill-subtle)' : undefined,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
                title={s.title ?? s.id}
              >
                {(s.title ?? s.id.slice(0, 12)) + ` (${s.messageCount})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hilo */}
      {modo === 'telegram-readonly' ? (
        <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--os-line-soft)', fontSize: 11, color: 'var(--os-accent)', background: 'var(--os-fill-subtle)' }}>
            Vista de solo lectura - conversacion de Telegram
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {telegramCargandoHilo && (
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>Cargando hilo de Telegram...</p>
            )}
            {!telegramCargandoHilo && telegramMensajes.length === 0 && (
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>Este hilo no tiene mensajes.</p>
            )}
            {telegramMensajes.map((m, i) => {
              const esUser = m.role === 'user';
              return (
                <div key={i} style={{ alignSelf: esUser ? 'flex-end' : 'flex-start', maxWidth: esUser ? '80%' : '88%' }}>
                  <div
                    style={{
                      background: esUser ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
                      border: esUser ? 'none' : '1px solid var(--os-line-soft)',
                      color: esUser ? '#fff' : 'var(--os-text)',
                      padding: '10px 14px',
                      borderRadius: esUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--os-muted)', marginTop: 2, textAlign: esUser ? 'right' : 'left' }}>
                    {horaCorta(m.timestamp)}
                  </div>
                </div>
              );
            })}
            {error && (
              <div style={{ color: 'var(--os-error)', fontSize: 12, border: '1px solid var(--os-error)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}
            <div ref={finRef} />
          </div>
        </div>
      ) : (
        <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          {activaId && (
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--os-line-soft)', fontSize: 11, color: 'var(--os-muted)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{etiquetaPerfil(conversaciones.find((c) => c.id === activaId)?.perfil ?? 'vps-default')}</span>
              {desktop && (
                <span title="Estado de Ollama local">
                  {ollama
                    ? ollama.available
                      ? `Ollama: ${ollama.version ?? 'activo'} (${ollama.models.length} modelos)`
                      : 'Ollama: no disponible'
                    : 'Ollama: consultando...'}
                </span>
              )}
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!activaId && (
              <p style={{ color: 'var(--os-muted)', fontSize: 13 }}>
                Crea una conversacion para hablar con Hermes. El hilo queda guardado en tu OS.
              </p>
            )}
            {mensajes.map((m) => {
              const esUser = m.rol === 'user';
              return (
                <div key={m.id} style={{ alignSelf: esUser ? 'flex-end' : 'flex-start', maxWidth: esUser ? '80%' : '88%' }}>
                  <div
                    style={{
                      background: esUser ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
                      border: esUser ? 'none' : '1px solid var(--os-line-soft)',
                      color: esUser ? '#fff' : 'var(--os-text)',
                      padding: '10px 14px',
                      borderRadius: esUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.contenido}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--os-muted)', marginTop: 2, textAlign: esUser ? 'right' : 'left' }}>
                    {horaCorta(m.created_at)}
                  </div>
                </div>
              );
            })}

            {runActivo && (
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
                Hermes esta trabajando... {segundosTrabajando}s (puede tardar 1 a 3 minutos)
              </div>
            )}

            {error && (
              <div style={{ color: 'var(--os-error)', fontSize: 12, border: '1px solid var(--os-error)', borderRadius: 8, padding: '8px 12px' }}>
                {error}
              </div>
            )}
            {desktop && flowMensaje && (
              <div style={{ color: 'var(--os-muted)', fontSize: 12 }}>{flowMensaje}</div>
            )}
            <div ref={finRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
            style={{ display: 'flex', gap: 8, padding: '0.75rem 1rem', borderTop: '1px solid var(--os-line-soft)' }}
          >
            {desktop && (
              <button
                type="button"
                className="os-btn"
                title="Adjuntar archivo local"
                onClick={() => void adjuntarArchivo()}
                disabled={!activaId || Boolean(runActivo)}
              >
                📎
              </button>
            )}
            {desktop && (
              <button
                type="button"
                className={grabando ? 'os-btn os-btn-primary' : 'os-btn'}
                title={grabando ? 'Detener grabacion de reunion (Flow)' : 'Iniciar grabacion de reunion (Flow)'}
                onClick={() => void alternarGrabacion()}
                disabled={flowBusy}
              >
                {grabando ? '⏹' : '🎙'}
              </button>
            )}
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={runActivo ? 'Hermes esta trabajando...' : 'Escribe un mensaje'}
              disabled={!activaId || Boolean(runActivo)}
              className="os-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="os-btn os-btn-primary" disabled={!activaId || Boolean(runActivo) || !texto.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
