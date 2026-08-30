// Chat soberano del OS: experiencia diaria tipo Telegram contra Hermes.
// Implementa os-chat-telegram-soberano (brain): hilo lineal persistido en el
// OS, envio async (POST devuelve 202 con el run) y polling del hilo hasta ver
// la respuesta final. Sin streaming crudo: estados simples + respuesta.
//
// Callers: src/routes/chat.tsx. API: /api/chat y /api/chat/:id.
// El Cockpit (/hermes) sigue siendo la vista power user; esto es la diaria.

import { useCallback, useEffect, useRef, useState } from 'react';

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

const POLL_MS = 3000;

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
    if (runActivo && activaId) {
      pollRef.current = setInterval(() => void cargarHilo(activaId), POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runActivo, activaId, cargarHilo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, runActivo?.estado]);

  async function nuevaConversacion() {
    setCargando(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await cargarConversaciones();
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
        <button type="button" className="os-btn os-btn-primary" onClick={() => void nuevaConversacion()} disabled={cargando}>
          Nueva conversacion
        </button>
        {conversaciones.map((c) => (
          <button
            key={c.id}
            type="button"
            className="os-btn"
            onClick={() => setActivaId(c.id)}
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              fontSize: 12,
              background: c.id === activaId ? 'var(--os-fill-subtle)' : undefined,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
            title={c.titulo}
          >
            {c.titulo}
          </button>
        ))}
      </div>

      {/* Hilo */}
      <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
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
    </div>
  );
}
