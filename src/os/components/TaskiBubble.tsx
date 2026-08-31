// Taski — burbuja flotante de chat directo con Hermes (agente del VPS).
// Visible en todo el OS (montada desde OSLayout). Historial del servidor al
// abrir + optimistic UI al enviar.
//
// Elegir sesion: ademas de la conversacion propia del OS ("pancho-os"), Taski
// ya guarda una sesion real por cada conversacion de Telegram. El selector
// del header cambia entre ellas sin salir de la burbuja; cambiar de sesion
// recarga el historial de esa conversacion puntual.
//
// Z-index: bottom-nav movil = 150, drawer = 200, Sheet = 300.
// Burbuja en 170 y panel en 190: encima del bottom-nav, debajo del drawer.
import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useVoiceDictation } from '../hooks/useVoiceDictation.ts';
import { useDraggableBubble } from '../hooks/useDraggableBubble.ts';

interface Turno {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface SesionTaski {
  id: string;
  source: string;
  title: string | null;
  preview: string | null;
  messageCount: number;
  lastActive: number | null;
}

interface ModeloTaski {
  id: string;
  name: string;
  provider?: string;
}

const SESION_OS_ID = 'pancho-os';

// Clampea la posicion vertical de la pestana de restaurar para que nunca
// quede pegada arriba/abajo del todo, aunque la burbuja se haya ocultado
// desde una esquina extrema.
function clampPestana(y: number, size: number): number {
  if (typeof window === 'undefined') return y;
  const min = 12;
  const max = window.innerHeight - size - 12;
  return Math.min(Math.max(y, min), max);
}

function etiquetaSesion(s: SesionTaski): string {
  if (s.id === SESION_OS_ID) return s.title || 'Taski (OS)';
  return s.title || (s.source === 'telegram' ? 'Conversacion sin titulo' : s.source);
}

function useEsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 821px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)');
    const fn = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return desktop;
}

export default function TaskiBubble() {
  const desktop = useEsDesktop();
  const bubbleSize = desktop ? 52 : 56;
  // Reserva espacio abajo para no tapar el bottom-nav movil (72px + safe area
  // aprox). En desktop no hay bottom-nav, asi que no reserva nada.
  const bottomReservado = desktop ? 0 : 86;
  const {
    pos: posArrastre,
    oculto: burbujaOculta,
    ocultar: ocultarBurbuja,
    mostrar: mostrarBurbuja,
    onPointerDown: onPointerDownBurbuja,
    registrarComoTap,
  } = useDraggableBubble({ size: bubbleSize, margin: desktop ? 22 : 14, bottomReservado });
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialListo, setHistorialListo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState('');
  // Arranca con la sesion del OS como unica opcion para que el selector nunca
  // este vacio mientras /api/taski/sesiones todavia no responde.
  const [sesiones, setSesiones] = useState<SesionTaski[]>([
    { id: SESION_OS_ID, source: 'api_server', title: 'Taski (OS)', preview: null, messageCount: 0, lastActive: null },
  ]);
  const [sesionActual, setSesionActual] = useState(SESION_OS_ID);
  const [modelos, setModelos] = useState<ModeloTaski[]>([]);
  const [modeloActual, setModeloActual] = useState('deepseek/deepseek-v4-flash');
  const [cambiandoModelo, setCambiandoModelo] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Dictado por voz
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceDictation({
    lang: 'es-EC',
    onResult: (transcripcion) => {
      setTexto((prev) => (prev ? `${prev} ${transcripcion}` : transcripcion));
    },
  });

  // Autoscroll al fondo cuando cambian los turnos o el indicador.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turnos, pensando, abierto, cargandoHistorial]);

  // Escape cierra el panel.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierto]);

  async function cargarHistorial(sessionId: string) {
    setCargandoHistorial(true);
    setTurnos([]);
    try {
      const res = await fetch(`/api/taski?session_id=${encodeURIComponent(sessionId)}`);
      const data: { mensajes?: { role: 'user' | 'assistant'; content: string }[]; error?: string } =
        await res.json();
      if (data.mensajes) {
        setTurnos(data.mensajes.map((m) => ({ role: m.role, content: m.content })));
        setHistorialListo(true);
      } else if (data.error) {
        setTurnos([{ role: 'error', content: 'No pude cargar el historial: ' + data.error }]);
      }
    } catch {
      setTurnos([{ role: 'error', content: 'No pude cargar el historial. Revisa tu conexion.' }]);
    }
    setCargandoHistorial(false);
  }

  async function cargarSesiones() {
    try {
      const res = await fetch('/api/taski/sesiones');
      const data: { sesiones?: SesionTaski[]; error?: string } = await res.json();
      if (data.sesiones?.length) setSesiones(data.sesiones);
    } catch {
      // Sin lista de sesiones queda igual la conversacion del OS por defecto.
    }
  }

  async function cargarModelos() {
    try {
      const res = await fetch('/api/taski/modelos');
      const data: { modelos?: ModeloTaski[] } = await res.json();
      if (data.modelos?.length) setModelos(data.modelos);
    } catch {
      // ignore
    }
  }

  function abrir() {
    setAbierto(true);
    if (sesiones.length <= 1) void cargarSesiones();
    if (!modelos.length) void cargarModelos();
    if (!historialListo && !cargandoHistorial) void cargarHistorial(sesionActual);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function cambiarSesion(id: string) {
    if (id === sesionActual || pensando) return;
    setSesionActual(id);
    void cargarHistorial(id);
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
    // Optimistic UI: el mensaje del usuario aparece de inmediato.
    setTurnos((prev) => [...prev, { role: 'user', content: msg }]);
    setPensando(true);
    try {
      const res = await fetch('/api/taski', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sesionActual }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      if (data.error || !res.ok) {
        setTurnos((prev) => [...prev, { role: 'error', content: data.error ?? `Error HTTP ${res.status}` }]);
      } else {
        setTurnos((prev) => [...prev, { role: 'assistant', content: data.reply || '(sin respuesta)' }]);
      }
    } catch {
      setTurnos((prev) => [...prev, { role: 'error', content: 'Error de conexion. Intenta de nuevo.' }]);
    } finally {
      setPensando(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  // Posicion de la burbuja: arrastrable, con clamp a los limites de pantalla.
  // Mientras la posicion inicial todavia no se calcula (primer render antes
  // del efecto), usa la esquina inferior derecha de siempre para no saltar.
  const posBurbuja: CSSProperties = posArrastre
    ? { left: posArrastre.x, top: posArrastre.y }
    : desktop
      ? { bottom: 22, right: 22 }
      : { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 14px)', right: 14 };

  const burbuja: CSSProperties = {
    position: 'fixed',
    zIndex: 170,
    width: bubbleSize,
    height: bubbleSize,
    borderRadius: 'var(--os-r-full, 999px)',
    background: 'var(--os-accent)',
    color: '#fff',
    border: 'none',
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--os-shadow-accent, 0 6px 18px rgba(59,78,217,0.4))',
    transition: 'transform 0.15s',
    touchAction: 'none',
    ...posBurbuja,
  };

  const botonOcultar: CSSProperties = {
    position: 'fixed',
    zIndex: 171,
    left: posArrastre ? posArrastre.x + bubbleSize - 8 : undefined,
    top: posArrastre ? posArrastre.y - 6 : undefined,
    width: 20,
    height: 20,
    borderRadius: 'var(--os-r-full, 999px)',
    background: 'var(--os-bg-sunken)',
    border: '1px solid var(--os-line-soft)',
    color: 'var(--os-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  };

  // Pestanita discreta para volver a mostrar la burbuja cuando esta oculta.
  // Se ancla al mismo borde vertical donde quedo antes de ocultarse.
  const pestanaRestaurar: CSSProperties = {
    position: 'fixed',
    zIndex: 170,
    right: 0,
    top: posArrastre ? clampPestana(posArrastre.y, bubbleSize) : '50%',
    width: 22,
    height: 44,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    background: 'var(--os-accent)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--os-shadow-accent, 0 4px 12px rgba(59,78,217,0.35))',
  };

  const panel: CSSProperties = desktop
    ? {
        position: 'fixed',
        zIndex: 190,
        bottom: 22,
        right: 22,
        width: 400,
        maxWidth: 'calc(100vw - 44px)',
        height: 'min(620px, calc(100dvh - 88px))',
        background: 'var(--os-surface)',
        border: '1px solid var(--os-line-accent)',
        borderRadius: 'var(--os-r-lg)',
        boxShadow: 'var(--os-shadow-modal)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : {
        // Movil: pantalla casi completa.
        position: 'fixed',
        zIndex: 190,
        inset: '52px 0 0 0',
        background: 'var(--os-surface)',
        borderTop: '1px solid var(--os-line-accent)',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      };

  const estiloTurno = (t: Turno): CSSProperties => {
    if (t.role === 'user') {
      return {
        alignSelf: 'flex-end',
        maxWidth: '85%',
        background: 'var(--os-accent)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '12px 12px 3px 12px',
        fontSize: 13,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      };
    }
    if (t.role === 'error') {
      return { alignSelf: 'flex-start', maxWidth: '85%', color: 'var(--os-error)', fontSize: 12, padding: '2px 0' };
    }
    return {
      alignSelf: 'flex-start',
      maxWidth: '90%',
      background: 'var(--os-fill-subtle)',
      border: '1px solid var(--os-line-soft)',
      color: 'var(--os-text)',
      padding: '9px 12px',
      borderRadius: '12px 12px 12px 3px',
      fontSize: 13,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    };
  };

  return (
    <>
      {abierto && (
        <div style={panel} role="dialog" aria-modal="false" aria-label="Taski, chat con Hermes">
          {/* Header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '0.625rem 0.875rem',
              borderBottom: '1px solid var(--os-line-soft)',
              background: 'var(--os-bg-sunken)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0, flexShrink: 0 }}>
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: 18, color: 'var(--os-accent-light)' }}
                >
                  smart_toy
                </span>
                <span
                  style={{
                    fontFamily: 'var(--os-font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--os-text)',
                  }}
                >
                  Taski
                </span>
              </span>

              {/* Selector de conversacion */}
              <select
                value={sesionActual}
                disabled={pensando}
                onChange={(e) => cambiarSesion(e.target.value)}
                aria-label="Elegir conversacion"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'var(--os-fill-subtle)',
                  border: '1px solid var(--os-line-soft)',
                  borderRadius: 'var(--os-r-md, 8px)',
                  color: 'var(--os-text)',
                  fontSize: 11,
                  padding: '4px 6px',
                  fontFamily: 'var(--os-font-body)',
                  cursor: pensando ? 'default' : 'pointer',
                }}
              >
                {sesiones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {etiquetaSesion(s)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar Taski"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: desktop ? 28 : 36,
                  height: desktop ? 28 : 36,
                  background: 'var(--os-fill-subtle)',
                  border: 'none',
                  borderRadius: 'var(--os-r-full, 999px)',
                  color: 'var(--os-muted)',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Selector de Modelo */}
            {modelos.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--os-muted)',
                    fontFamily: 'var(--os-font-display)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  Modelo:
                </span>
                <select
                  value={modeloActual}
                  disabled={pensando || cambiandoModelo}
                  onChange={(e) => cambiarModelo(e.target.value)}
                  aria-label="Elegir modelo de IA"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: '1px dashed var(--os-line-soft)',
                    borderRadius: '4px',
                    color: 'var(--os-text-2, var(--os-muted))',
                    fontSize: 10,
                    padding: '2px 4px',
                    fontFamily: 'var(--os-font-body)',
                    cursor: pensando || cambiandoModelo ? 'default' : 'pointer',
                  }}
                >
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mensajes */}
          <div
            ref={bodyRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.875rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {cargandoHistorial && !turnos.length && (
              <p style={{ margin: 'auto', color: 'var(--os-muted)', fontSize: 12, textAlign: 'center' }}>
                Cargando conversacion...
              </p>
            )}
            {!cargandoHistorial && !turnos.length && (
              <p style={{ margin: 'auto', color: 'var(--os-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
                Este es tu canal directo con Hermes.
                <br />
                Elegi arriba que conversacion ver, o escribi para empezar una nueva.
              </p>
            )}
            {turnos.map((t, i) => (
              <div key={i} style={estiloTurno(t)}>
                {t.content}
              </div>
            ))}
            {pensando && (
              <span
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  color: 'var(--os-muted)',
                  fontSize: 12,
                  padding: '2px 0',
                }}
              >
                <style>{'@keyframes taski-spin { to { transform: rotate(360deg); } }'}</style>
                <span
                  aria-hidden="true"
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    border: '2px solid var(--os-line)',
                    borderTopColor: 'var(--os-accent)',
                    animation: 'taski-spin 0.8s linear infinite',
                    flexShrink: 0,
                  }}
                />
                Hermes esta pensando...
              </span>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
              padding: desktop
                ? '0.625rem 0.75rem'
                : '0.625rem 0.75rem calc(0.625rem + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid var(--os-line-soft)',
              flexShrink: 0,
              background: 'var(--os-bg-sunken)',
            }}
          >
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder="Escribele a Hermes..."
              aria-label="Mensaje para Hermes"
              style={{
                flex: 1,
                resize: 'none',
                minHeight: desktop ? 38 : 44,
                maxHeight: 120,
                background: 'var(--os-fill-subtle)',
                border: '1px solid var(--os-line)',
                borderRadius: 'var(--os-r-md, 8px)',
                padding: '9px 11px',
                fontSize: 13,
                color: 'var(--os-text)',
                fontFamily: 'var(--os-font-body)',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={pensando}
                aria-label={isListening ? 'Detener dictado' : 'Dictar por voz'}
                title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: desktop ? 38 : 44,
                  height: desktop ? 38 : 44,
                  background: isListening ? 'rgba(239, 68, 68, 0.15)' : 'var(--os-fill-subtle)',
                  color: isListening ? 'var(--os-error, #ef4444)' : 'var(--os-muted)',
                  border: isListening ? '1px solid var(--os-error, #ef4444)' : 'none',
                  borderRadius: 'var(--os-r-md, 8px)',
                  cursor: pensando ? 'default' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
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
              aria-label="Enviar mensaje"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: desktop ? 38 : 44,
                height: desktop ? 38 : 44,
                background: pensando || !texto.trim() ? 'var(--os-fill-subtle)' : 'var(--os-accent)',
                color: pensando || !texto.trim() ? 'var(--os-muted)' : '#fff',
                border: 'none',
                borderRadius: 'var(--os-r-md, 8px)',
                cursor: pensando || !texto.trim() ? 'default' : 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20 }}>
                send
              </span>
            </button>
          </div>
        </div>
      )}

      {!abierto && !burbujaOculta && (
        <>
          <button
            type="button"
            onPointerDown={onPointerDownBurbuja}
            onClick={registrarComoTap(abrir)}
            aria-label="Abrir Taski, chat con Hermes. Arrastra para moverla"
            style={burbuja}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 26 }}>
              smart_toy
            </span>
          </button>
          <button
            type="button"
            onClick={ocultarBurbuja}
            aria-label="Ocultar Taski"
            title="Ocultar Taski"
            style={botonOcultar}
          >
            ×
          </button>
        </>
      )}

      {!abierto && burbujaOculta && (
        <button
          type="button"
          onClick={mostrarBurbuja}
          aria-label="Mostrar Taski, chat con Hermes"
          title="Mostrar Taski"
          style={pestanaRestaurar}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>
            smart_toy
          </span>
        </button>
      )}
    </>
  );
}
