// Caja de Hoy para pedirle cosas al agente ("agrega X", "recuerdame Y") sin
// tener que abrir la burbuja de Taski.
//
// Manda a POST /api/taski, que es la MISMA sesion de Hermes que usa TaskiBubble
// ("pancho-os"). Por eso esto no parte el historial en dos: lo que se escribe
// aca aparece despues en la burbuja, que lee el historial del servidor al abrir.
//
// Version minima a proposito. Elegir perfil (VPS, homelab, laptop), ver el
// kanban de pendientes de Hermes y cambiar de modelo van en el modulo aparte de
// Hermes, no aca.
import { useState } from 'react';
import { useVoiceDictation } from '../hooks/useVoiceDictation.ts';

// Hermes puede tardar: el proxy corta a los 60s (CHAT_TIMEOUT_MS).
const AVISO_LENTO_MS = 8000;

export default function OSPedirAlAgente() {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dictado por voz
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceDictation({
    lang: 'es-EC',
    onResult: (transcripcion) => {
      setTexto((prev) => (prev ? `${prev} ${transcripcion}` : transcripcion));
    },
  });

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;

    setEnviando(true);
    setLento(false);
    setError(null);
    setRespuesta(null);
    const avisoLento = window.setTimeout(() => setLento(true), AVISO_LENTO_MS);

    try {
      const res = await fetch('/api/taski', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensaje }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'No se pudo hablar con el agente.');
        return;
      }
      // El mensaje solo se limpia si de verdad se envio: si fallo, queda escrito
      // para reintentar sin volver a tipearlo.
      setTexto('');
      setRespuesta(data.reply || 'El agente respondio vacio.');
    } catch {
      setError('No se pudo hablar con el agente.');
    } finally {
      window.clearTimeout(avisoLento);
      setEnviando(false);
      setLento(false);
    }
  }

  return (
    <div className="os-card" style={{ marginBottom: '1rem' }}>
      <p className="os-section-title">Pedile algo al agente</p>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="os-input"
          placeholder="Agrega... recuerdame... anota..."
          value={texto}
          disabled={enviando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
          style={{ flex: 1 }}
        />
        {voiceSupported && (
          <button
            type="button"
            className="os-btn"
            onClick={toggleListening}
            disabled={enviando}
            title={isListening ? 'Detener dictado' : 'Dictar por voz'}
            style={{
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isListening ? 'var(--os-error, #ef4444)' : 'var(--os-muted)',
              borderColor: isListening ? 'var(--os-error, #ef4444)' : undefined,
              background: isListening ? 'rgba(239, 68, 68, 0.12)' : undefined,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 18,
                animation: isListening ? 'os-pulse 1.2s infinite' : 'none',
              }}
            >
              {isListening ? 'mic' : 'mic_none'}
            </span>
          </button>
        )}
        <button className="os-btn" onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </div>

      {lento && (
        <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '0.625rem 0 0' }}>
          El agente esta pensando. Puede tardar hasta un minuto.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: 'var(--os-error)', margin: '0.625rem 0 0' }}>
          {error}
        </p>
      )}

      {respuesta && (
        <div style={{
          marginTop: '0.75rem', padding: '0.75rem', borderRadius: 8,
          background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)',
        }}>
          <p style={{ fontSize: 13, color: 'var(--os-text-2)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {respuesta}
          </p>
          <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0.5rem 0 0' }}>
            La conversacion completa vive en Taski, abajo a la derecha.
          </p>
        </div>
      )}
    </div>
  );
}
