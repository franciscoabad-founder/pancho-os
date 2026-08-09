// Taski — burbuja flotante de chat directo con Hermes (agente del VPS).
// Visible en todo el OS (montada desde OSLayout). Una sola conversacion
// continua (sesion "pancho-os" en el servidor). Historial del servidor al
// abrir + optimistic UI al enviar.
//
// Z-index: bottom-nav movil = 150, drawer = 200, Sheet = 300.
// Burbuja en 170 y panel en 190: encima del bottom-nav, debajo del drawer.
import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

interface Turno {
  role: 'user' | 'assistant' | 'error';
  content: string;
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
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialListo, setHistorialListo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  async function cargarHistorial() {
    setCargandoHistorial(true);
    try {
      const res = await fetch('/api/os/taski');
      const data: { mensajes?: { role: 'user' | 'assistant'; content: string }[]; error?: string } =
        await res.json();
      if (data.mensajes) {
        setTurnos(data.mensajes.map((m) => ({ role: m.role, content: m.content })));
        setHistorialListo(true);
      } else if (data.error) {
        setTurnos((prev) => (prev.length ? prev : [{ role: 'error', content: 'No pude cargar el historial: ' + data.error }]));
      }
    } catch {
      setTurnos((prev) => (prev.length ? prev : [{ role: 'error', content: 'No pude cargar el historial. Revisa tu conexion.' }]));
    }
    setCargandoHistorial(false);
  }

  function abrir() {
    setAbierto(true);
    if (!historialListo && !cargandoHistorial) void cargarHistorial();
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  async function enviar() {
    const msg = texto.trim();
    if (!msg || pensando) return;
    setTexto('');
    // Optimistic UI: el mensaje del usuario aparece de inmediato.
    setTurnos((prev) => [...prev, { role: 'user', content: msg }]);
    setPensando(true);
    try {
      const res = await fetch('/api/os/taski', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data: { reply?: string; error?: string } = await res.json();
      if (data.error || !res.ok) {
        setTurnos((prev) => [...prev, { role: 'error', content: data.error ?? `Error HTTP ${res.status}` }]);
      } else {
        setTurnos((prev) => [...prev, { role: 'assistant', content: data.reply || '(sin respuesta)' }]);
      }
    } catch {
      setTurnos((prev) => [...prev, { role: 'error', content: 'Error de conexion. Intenta de nuevo.' }]);
    }
    setPensando(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  // Posicion de la burbuja: en movil queda encima del bottom-nav (72px + safe area).
  const posBurbuja: CSSProperties = desktop
    ? { bottom: 22, right: 22 }
    : { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 14px)', right: 14 };

  const burbuja: CSSProperties = {
    position: 'fixed',
    zIndex: 170,
    width: desktop ? 52 : 56,
    height: desktop ? 52 : 56,
    borderRadius: 'var(--os-r-full, 999px)',
    background: 'var(--os-accent)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--os-shadow-accent, 0 6px 18px rgba(59,78,217,0.4))',
    transition: 'transform 0.15s',
    ...posBurbuja,
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
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '0.625rem 0.875rem',
              borderBottom: '1px solid var(--os-line-soft)',
              background: 'var(--os-bg-sunken)',
              flexShrink: 0,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
              <span style={{ fontSize: 11, color: 'var(--os-muted)' }}>Hermes en el VPS</span>
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar Taski"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: desktop ? 36 : 44,
                height: desktop ? 36 : 44,
                background: 'var(--os-fill-subtle)',
                border: 'none',
                borderRadius: 'var(--os-r-full, 999px)',
                color: 'var(--os-muted)',
                cursor: 'pointer',
                fontSize: 17,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
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
                Una sola conversacion continua, desde cualquier pantalla del OS.
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

      {!abierto && (
        <button type="button" onClick={abrir} aria-label="Abrir Taski, chat con Hermes" style={burbuja}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 26 }}>
            smart_toy
          </span>
        </button>
      )}
    </>
  );
}
