// Pagina /hermes/telegram: replica de tus grupos de Telegram dentro del OS.
// Grupos y chats privados -> topics -> conversacion, igual que en Telegram.
// Fase 3 del plan docs/plan-hermes-en-os.md. Solo lectura: los mensajes se
// actualizan solos cada 8 s. Para responder se abre la sesion en Hermes
// completo (solo Tailscale). Escribir desde aqui a Telegram queda pendiente de
// la decision 1c de docs/DECISIONES-PENDIENTES.md (necesita el token del bot).
// Datos: /api/hermes/sesiones?canal=telegram y /api/hermes/mensajes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import { arbolTelegram, type MensajeHermes, type SesionHermes } from '../../os/lib/canalesHermes.ts';

const HERMES_UI_URL: string = import.meta.env.VITE_HERMES_UI_URL ?? 'http://100.127.42.51:9120';
const REFRESCO_MENSAJES_MS = 8_000;
const REFRESCO_LISTA_MS = 45_000;

export const Route = createFileRoute('/hermes_/telegram')({
  head: () => ({ meta: [{ title: tituloOs('Telegram en Hermes') }] }),
  component: TelegramPage,
});

function hace(segundos: number | null): string {
  if (!segundos) return '';
  const d = Math.max(0, Date.now() / 1000 - segundos);
  if (d < 90) return 'ahora';
  if (d < 3600) return `${Math.round(d / 60)} min`;
  if (d < 86_400) return `${Math.round(d / 3600)} h`;
  return `${Math.round(d / 86_400)} d`;
}

const hora = (s: number | null) =>
  s ? new Date(s * 1000).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: 0 };
const titulo: React.CSSProperties = {
  margin: 0, padding: '12px 14px', fontSize: 'var(--os-text-base)', borderBottom: '1px solid var(--os-border)',
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
};
const fila = (activa: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0, cursor: 'pointer',
  borderBottom: '1px solid var(--os-border)', color: 'inherit',
  background: activa ? 'rgba(59,78,217,0.16)' : 'transparent',
});
const suave: React.CSSProperties = { fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)' };

function TelegramPage() {
  const [sesiones, setSesiones] = useState<SesionHermes[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [topicKey, setTopicKey] = useState<string | null>(null);
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<MensajeHermes[] | null>(null);
  const [errorMensajes, setErrorMensajes] = useState<string | null>(null);
  const [verHerramientas, setVerHerramientas] = useState(false);
  // Celular: se ve una columna a la vez (chats -> topics -> conversacion). Solo CSS.
  const [nivel, setNivel] = useState<'chats' | 'topics' | 'conversacion'>('chats');
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      fetch('/api/hermes/sesiones?canal=telegram&limite=500')
        .then(async (res) => {
          const c = await res.json();
          if (!res.ok) throw new Error(c?.error ?? `HTTP ${res.status}`);
          if (vivo) {
            setSesiones(c.sesiones as SesionHermes[]);
            setErrorLista(null);
          }
        })
        .catch((e) => vivo && setErrorLista(e instanceof Error ? e.message : String(e)));
    void cargar();
    const t = setInterval(cargar, REFRESCO_LISTA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const arbol = useMemo(() => arbolTelegram(sesiones ?? []), [sesiones]);
  const chat = arbol.find((c) => c.chatId === chatId) ?? null;
  const topic = chat?.topics.find((t) => (t.topic ?? '') === topicKey) ?? null;
  const sesion = topic?.sesiones.find((s) => s.id === sesionId) ?? topic?.sesiones[0] ?? null;

  // Al cambiar de topic se abre su sesion mas reciente.
  useEffect(() => {
    setSesionId(null);
  }, [chatId, topicKey]);

  useEffect(() => {
    if (!sesion) {
      setMensajes(null);
      return;
    }
    let vivo = true;
    setMensajes(null);
    const cargar = () =>
      fetch(`/api/hermes/mensajes?id=${encodeURIComponent(sesion.id)}&perfil=${encodeURIComponent(sesion.perfil)}&limite=150`)
        .then(async (res) => {
          const c = await res.json();
          if (!res.ok) throw new Error(c?.error ?? `HTTP ${res.status}`);
          if (vivo) {
            setMensajes(c.mensajes as MensajeHermes[]);
            setErrorMensajes(null);
          }
        })
        .catch((e) => vivo && setErrorMensajes(e instanceof Error ? e.message : String(e)));
    void cargar();
    const t = setInterval(cargar, REFRESCO_MENSAJES_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [sesion?.id, sesion?.perfil]);

  const ultimoId = mensajes?.[mensajes.length - 1]?.id;
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [ultimoId, sesion?.id]);

  const visibles = (mensajes ?? []).filter((m) => verHerramientas || m.rol !== 'herramienta');

  return (
    <OSLayout title="Telegram en Hermes">
      <div className="os-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PageHeader
          eyebrow="Operacion Agente"
          title="Telegram en Hermes"
          subtitle="Tus grupos y chats de Telegram con sus topics, tal como los ve Hermes. Solo lectura: se actualiza sola cada 8 segundos."
        />
        {errorLista && <div className="os-card" role="alert" style={{ padding: 14 }}>No pude leer Telegram desde Hermes: {errorLista}</div>}
        {!sesiones && !errorLista && <div className="os-card" style={{ padding: 14 }}>Cargando…</div>}

        {sesiones && (
          <>
          {/* Fuera de la grilla: si fuera su primer hijo, desplazaria los nth-child de abajo. */}
          <style>{`
            .hermes-tg { display: grid; grid-template-columns: 250px 250px minmax(0,1fr); gap: 12px; }
            .hermes-tg .volver { display: none; }
            @media (max-width: 900px) {
              .hermes-tg { grid-template-columns: minmax(0,1fr); }
              .hermes-tg .volver { display: inline-flex; }
              .hermes-tg[data-nivel="chats"] > section:not(:nth-child(1)),
              .hermes-tg[data-nivel="topics"] > section:not(:nth-child(2)),
              .hermes-tg[data-nivel="conversacion"] > section:not(:nth-child(3)) { display: none !important; }
            }
          `}</style>
          <div className="hermes-tg" data-nivel={nivel} style={{ height: 'calc(100vh - 260px)', minHeight: 460 }}>

            <section className="os-card" style={panel}>
              <h2 style={titulo}>Grupos y chats</h2>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {arbol.length === 0 && <p style={{ padding: 14, margin: 0 }}>Sin conversaciones de Telegram.</p>}
                {arbol.map((c) => (
                  <button
                    key={c.chatId}
                    onClick={() => {
                      const unico = c.topics.length === 1;
                      setChatId(c.chatId);
                      setTopicKey(unico ? (c.topics[0].topic ?? '') : null);
                      setNivel(unico ? 'conversacion' : 'topics');
                    }}
                    style={fila(c.chatId === chatId)}
                    type="button"
                  >
                    <strong style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#2AABEE' }}>{c.tipo === 'group' ? 'groups' : 'person'}</span>
                      {c.nombre}
                    </strong>
                    <span style={suave}>
                      {c.topics.length} {c.tipo === 'group' ? 'topics' : 'conversaciones'} · {hace(c.ultimaActividad)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="os-card" style={panel}>
              <h2 style={titulo}>
                <button className="volver os-btn os-btn-ghost" onClick={() => setNivel('chats')} type="button">←</button>
                {chat ? `Topics de ${chat.nombre}` : 'Topics'}
              </h2>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {!chat && <p style={{ padding: 14, margin: 0, ...suave }}>Elige un grupo.</p>}
                {chat?.topics.map((t) => (
                  <button
                    key={t.topic ?? 'general'}
                    onClick={() => {
                      setTopicKey(t.topic ?? '');
                      setNivel('conversacion');
                    }}
                    style={fila((t.topic ?? '') === topicKey)}
                    type="button"
                  >
                    <strong>{t.etiqueta}</strong>
                    <span style={{ ...suave, display: 'block', overflowWrap: 'anywhere' }}>{t.sesiones[0]?.titulo}</span>
                    <span style={suave}>
                      {[...new Set(t.sesiones.map((s) => s.perfilEtiqueta))].join(', ')} · {hace(t.ultimaActividad)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="os-card" style={panel}>
              <h2 style={titulo}>
                <button
                  className="volver os-btn os-btn-ghost"
                  onClick={() => setNivel(chat && chat.topics.length > 1 ? 'topics' : 'chats')}
                  type="button"
                >
                  ←
                </button>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                  {sesion ? `${chat?.nombre} · ${topic?.etiqueta}` : 'Conversación'}
                </span>
                {topic && topic.sesiones.length > 1 && (
                  <select aria-label="Sesion del topic" onChange={(e) => setSesionId(e.target.value)} value={sesion?.id ?? ''}>
                    {topic.sesiones.map((s) => (
                      <option key={s.id} value={s.id}>{s.perfilEtiqueta} · {hace(s.ultimaActividad)}</option>
                    ))}
                  </select>
                )}
                <label style={{ ...suave, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input checked={verHerramientas} onChange={(e) => setVerHerramientas(e.target.checked)} type="checkbox" /> Herramientas
                </label>
              </h2>
              <div style={{ overflowY: 'auto', flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!sesion && <p style={{ margin: 0, ...suave }}>Elige un topic para ver la conversación.</p>}
                {sesion && !mensajes && !errorMensajes && <p style={{ margin: 0 }}>Cargando mensajes…</p>}
                {errorMensajes && <p role="alert" style={{ margin: 0 }}>No pude leer los mensajes: {errorMensajes}</p>}
                {visibles.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.rol === 'usuario' ? 'flex-start' : m.rol === 'agente' ? 'flex-end' : 'stretch',
                      maxWidth: m.rol === 'herramienta' ? '100%' : '85%',
                      padding: '8px 12px', borderRadius: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                      fontSize: m.rol === 'herramienta' ? 'var(--os-text-sm)' : undefined,
                      background: m.rol === 'usuario' ? 'rgba(42,171,238,0.14)' : m.rol === 'agente' ? 'rgba(59,78,217,0.14)' : 'rgba(148,163,184,0.14)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--os-muted)', marginBottom: 2 }}>
                      {m.rol === 'usuario' ? 'Tú' : m.rol === 'agente' ? sesion?.perfilEtiqueta : `Herramienta${m.herramienta ? ` · ${m.herramienta}` : ''}`} · {hora(m.hora)}
                    </div>
                    {m.rol === 'herramienta' ? m.texto.slice(0, 600) + (m.texto.length > 600 ? '…' : '') : m.texto}
                  </div>
                ))}
                <div ref={fin} />
              </div>
              <div style={{ ...suave, padding: '10px 14px', borderTop: '1px solid var(--os-border)', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>Solo lectura. Para responder, abre la sesión en Hermes completo.</span>
                {sesion && (
                  <a href={`${HERMES_UI_URL}/#/${encodeURIComponent(sesion.id)}`} rel="noreferrer" target="_blank">
                    Abrir en Hermes completo
                  </a>
                )}
              </div>
            </section>
          </div>
          </>
        )}
      </div>
    </OSLayout>
  );
}
