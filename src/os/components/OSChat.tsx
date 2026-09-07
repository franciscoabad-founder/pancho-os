// Chat soberano del OS: experiencia diaria tipo Telegram contra Hermes.
// Implementa os-chat-telegram-soberano (brain): hilo lineal persistido en el
// OS y la respuesta final guardada del lado del OS, no del agente.
//
// F1 (streaming) agrega presentacion en vivo encima de eso, sin cambiar quien
// manda: el envio va por /api/chat/:id/stream y pinta una burbuja provisional
// con los deltas y un chip con la herramienta en curso, pero el transcript real
// se recarga de /api/chat/:id al cerrar el turno. El polling sigue existiendo
// como red para cuando el stream no llega a abrirse o el hilo se abre con un
// run ya en vuelo.
//
// Callers: src/routes/chat.tsx. API: /api/chat, /api/chat/:id y /api/chat/:id/stream.
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
import { useVoiceDictation } from '../hooks/useVoiceDictation.ts';
import { etiquetaSesion, fechaSesion, nombreSesion, tooltipSesion } from '../lib/sesiones.ts';
import { leerSse } from '../lib/sse.ts';
import { PERFILES_HERMES, etiquetaPerfilHermes } from '../lib/perfilesHermes.ts';

interface Conversacion {
  id: string;
  titulo: string;
  /** Nodo donde corre Hermes. */
  perfil: string;
  /** Agente real que atiende el tema (default/Alfred, arazza, ...). */
  perfil_hermes?: string;
  updated_at: string;
}

/** Estado de salud de un perfil real, tal como lo da /api/taski/perfiles. */
interface EstadoPerfilHermes {
  id: string;
  etiqueta: string;
  online: boolean;
  configurado: boolean;
  motivo: string | null;
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

// Sesiones que Hermes ya guarda en el VPS. Vista de solo lectura: no hay
// envio, no hay polling, solo se listan y se leen. El campo de datos es
// role/content/timestamp, distinto de rol/contenido/created_at del OS.
//
// Ya no son solo las de Telegram: el proxy dejo de filtrar source=telegram, y
// `origen` separa las de Telegram de las nacidas en el OS. Las pestanas
// Telegram / OS / Todas viven en `origenHermes`.
interface SesionHermes {
  id: string;
  source: string;
  origen: 'telegram' | 'os';
  title: string | null;
  preview: string | null;
  messageCount: number;
  /** Epoch en milisegundos, ya normalizado por el server. */
  lastActive: number | null;
  alias?: boolean;
  tituloHermes?: string | null;
}

type FiltroOrigen = 'telegram' | 'os' | 'todas';

interface TelegramMensaje {
  role: 'user' | 'assistant' | 'sistema';
  content: string;
  /** Epoch en milisegundos (el proxy ya normaliza los segundos de Hermes). */
  timestamp: number | null;
}

const POLL_MS = 3000;

// Evento que manda el server por /api/chat/:id/stream (ver EventoHermes en
// src/server/taski.handlers.ts). El `data:` de cada trama es este objeto.
interface EventoStream {
  tipo: string;
  texto?: string;
  herramienta?: string;
  detalle?: string;
  datos?: Record<string, unknown>;
}

/** Chip que se muestra encima del input mientras Hermes usa una herramienta. */
interface HerramientaEnCurso {
  nombre: string;
  estado: 'corriendo' | 'ok' | 'fallo';
  detalle?: string;
}

function textoHerramienta(h: HerramientaEnCurso): string {
  if (h.estado === 'corriendo') return `Ejecutando ${h.nombre}`;
  if (h.estado === 'ok') return `${h.nombre} listo`;
  return `${h.nombre} fallo`;
}

// Cada conversacion elige en que NODO corre Hermes. El del VPS tiene Telegram,
// memoria canonica y n8n; el de la laptop trabaja con el terminal y los
// archivos de la laptop; el del HomeLab con la GPU local. Que AGENTE atiende
// (Alfred, Arazza, ...) es el otro eje, y sale de PERFILES_HERMES.
const PERFILES: Array<{ id: string; etiqueta: string }> = [
  { id: 'vps-default', etiqueta: 'Hermes VPS' },
  { id: 'laptop-local', etiqueta: 'Hermes Laptop' },
  { id: 'homelab-local', etiqueta: 'Hermes HomeLab' },
];

function etiquetaPerfil(id: string): string {
  return PERFILES.find((p) => p.id === id)?.etiqueta ?? id;
}

// Acepta ISO (mensajes propios del OS) o epoch en milisegundos (mensajes que
// vienen de Hermes). Antes solo aceptaba ISO y los de Hermes, que son
// numericos, se pintaban como horas de 1970.
function horaCorta(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
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

  // Streaming (F1): burbuja provisional con el texto que va llegando y chip de
  // la herramienta en curso. Nada de esto es la verdad: el transcript real se
  // recarga de /api/chat/:id cuando el turno cierra.
  const [parcial, setParcial] = useState('');
  const [herramienta, setHerramienta] = useState<HerramientaEnCurso | null>(null);
  const [streamAbierto, setStreamAbierto] = useState(false);

  // 'os' = conversacion soberana editable. 'telegram-readonly' = viendo un
  // hilo de Telegram que Hermes ya guardo en el VPS, sin input ni polling.
  const [modo, setModo] = useState<'os' | 'telegram-readonly'>('os');
  const [telegramAbierto, setTelegramAbierto] = useState(false);
  const [telegramSesiones, setTelegramSesiones] = useState<SesionHermes[]>([]);
  const [telegramCargandoLista, setTelegramCargandoLista] = useState(false);
  const [telegramActivaId, setTelegramActivaId] = useState<string | null>(null);
  const [telegramMensajes, setTelegramMensajes] = useState<TelegramMensaje[]>([]);
  const [telegramCargandoHilo, setTelegramCargandoHilo] = useState(false);
  // Pestanas de la seccion de sesiones de Hermes. Por defecto todas, ordenadas
  // por ultima actividad: antes el proxy filtraba source=telegram y las
  // conversaciones del propio OS (os-chat-*) no aparecian nunca.
  const [origenHermes, setOrigenHermes] = useState<FiltroOrigen>('todas');
  // Salud de los perfiles reales, para el puntito de cada grupo del panel.
  const [saludPerfiles, setSaludPerfiles] = useState<EstadoPerfilHermes[]>([]);

  // Renombrado inline de una conversacion del OS.
  const [renombrandoId, setRenombrandoId] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);

  // --- Bridge nativo (solo app de escritorio, Tauri) -----------------------
  const desktop = isDesktop();
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [meetingId, setMeetingId] = useState<number | null>(null);
  const [flowMensaje, setFlowMensaje] = useState<string | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);

  // Dictado por voz: mismo hook que usa la burbuja flotante (TaskiBubble),
  // el texto reconocido se agrega al input del chat soberano.
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceDictation({
    lang: 'es-EC',
    onResult: (transcripcion) => {
      setTexto((prev) => (prev ? `${prev} ${transcripcion}` : transcripcion));
    },
  });

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

  // Salud de los perfiles reales de Hermes. Si el endpoint falla, la lista
  // queda vacia y los grupos se pintan sin punto: es informacion adicional,
  // no puede romper el panel.
  const cargarSaludPerfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/taski/perfiles');
      if (!res.ok) return;
      const data = await res.json();
      setSaludPerfiles((data.perfiles ?? []) as EstadoPerfilHermes[]);
    } catch {
      // sin salud: el panel funciona igual
    }
  }, []);

  // El filtro por origen lo hace el server (?origen=), que ya devuelve la
  // lista ordenada por ultima actividad. El nodo ya no va fijo a vps-default:
  // se consulta el del tema abierto, que es el Hermes que el usuario esta
  // mirando.
  const cargarSesionesHermes = useCallback(async (origen: FiltroOrigen, nodo: string) => {
    setTelegramCargandoLista(true);
    try {
      const res = await fetch(`/api/taski/sesiones?profile_id=${encodeURIComponent(nodo)}&origen=${origen}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTelegramSesiones((data.sesiones ?? []) as SesionHermes[]);
    } catch (e) {
      setError(`No se pudieron cargar las sesiones de Hermes: ${String(e)}`);
    } finally {
      setTelegramCargandoLista(false);
    }
  }, []);

  const abrirHiloHermes = useCallback(async (id: string, nodo: string) => {
    setModo('telegram-readonly');
    setTelegramActivaId(id);
    setTelegramCargandoHilo(true);
    setError(null);
    try {
      const res = await fetch(`/api/taski?session_id=${encodeURIComponent(id)}&profile_id=${encodeURIComponent(nodo)}`);
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
    void cargarSaludPerfiles();
  }, [cargarConversaciones, cargarSaludPerfiles]);

  useEffect(() => {
    if (activaId) void cargarHilo(activaId);
  }, [activaId, cargarHilo]);

  // Polling solo mientras hay un run activo Y no hay stream abierto. Con
  // streaming es redundante, pero se queda como red: cubre el stream que se
  // cae antes del primer evento y el caso de abrir un hilo que ya tenia un run
  // en vuelo (recarga a mitad de turno, o el turno lo lanzo otro dispositivo).
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (modo === 'os' && runActivo && activaId && !streamAbierto) {
      pollRef.current = setInterval(() => void cargarHilo(activaId), POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [modo, runActivo, activaId, streamAbierto, cargarHilo]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes.length, runActivo?.estado, telegramMensajes.length, parcial]);

  const [perfilNuevo, setPerfilNuevo] = useState('vps-default');
  const [perfilHermesNuevo, setPerfilHermesNuevo] = useState('default');

  // Nodo del tema abierto: es contra el que se consultan las sesiones crudas
  // de Hermes de la seccion de solo lectura. Antes iba fijo a vps-default.
  const conversacionActiva = conversaciones.find((c) => c.id === activaId);
  const nodoActivo = conversacionActiva?.perfil ?? 'vps-default';

  // Panel lateral agrupado por agente: el orden de los grupos es el del
  // catalogo (Alfred primero) y adentro manda updated_at, que es como ya venia
  // ordenada la lista del server.
  const grupos = PERFILES_HERMES.map((p) => ({
    perfil: p,
    salud: saludPerfiles.find((s) => s.id === p.id) ?? null,
    conversaciones: conversaciones.filter((c) => (c.perfil_hermes ?? 'default') === p.id),
  })).filter((g) => g.conversaciones.length > 0);

  // Renombrar una conversacion del OS. El titulo automatico solo pisa
  // 'Nueva conversacion', asi que un nombre puesto a mano sobrevive; el server
  // ademas lo replica a la sesion de Hermes para que se vea igual en la
  // burbuja y el cockpit.
  async function guardarNombre(conversacionId: string) {
    const titulo = nombreNuevo.trim();
    if (!titulo) return;
    setGuardandoNombre(true);
    try {
      const res = await fetch(`/api/chat/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRenombrandoId(null);
      setError(null);
      await cargarConversaciones();
    } catch (e) {
      setError(`No se pudo renombrar: ${String(e)}`);
    } finally {
      setGuardandoNombre(false);
    }
  }

  async function nuevaConversacion() {
    setCargando(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil: perfilNuevo, perfil_hermes: perfilHermesNuevo }),
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

  // Envio con streaming: el POST devuelve un text/event-stream y el turno se va
  // pintando en vivo. Si el stream se cae, el run sigue corriendo en el server
  // y el polling (que vuelve a activarse al cerrar el stream) trae la respuesta.
  async function enviar() {
    const contenido = texto.trim();
    const conversacionId = activaId;
    if (!contenido || !conversacionId || runActivo || streamAbierto) return;
    setTexto('');
    setError(null);
    setParcial('');
    setHerramienta(null);
    // Optimista: el mensaje aparece ya, como en Telegram.
    setMensajes((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, rol: 'user', contenido, created_at: new Date().toISOString() },
    ]);

    setStreamAbierto(true);
    let recargado = false;
    try {
      const res = await fetch(`/api/chat/${conversacionId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      void cargarConversaciones();

      await leerSse(res.body, (trama) => {
        let evento: EventoStream;
        try {
          evento = JSON.parse(trama.datos) as EventoStream;
        } catch {
          return;
        }
        switch (evento.tipo) {
          case 'run.started': {
            const run = evento.datos?.run as Run | undefined;
            if (run) setRunActivo(run);
            break;
          }
          case 'assistant.delta': {
            const delta = evento.texto;
            if (delta) setParcial((prev) => prev + delta);
            break;
          }
          case 'tool.started':
            setHerramienta({ nombre: evento.herramienta ?? 'una herramienta', estado: 'corriendo', detalle: evento.detalle });
            break;
          case 'tool.progress':
            setHerramienta((prev) => ({
              nombre: evento.herramienta ?? prev?.nombre ?? 'una herramienta',
              estado: 'corriendo',
              detalle: evento.detalle ?? prev?.detalle,
            }));
            break;
          case 'tool.completed':
            setHerramienta({ nombre: evento.herramienta ?? 'la herramienta', estado: 'ok', detalle: evento.detalle });
            break;
          case 'tool.failed':
            setHerramienta({ nombre: evento.herramienta ?? 'la herramienta', estado: 'fallo', detalle: evento.detalle });
            break;
          case 'error':
            setError(evento.detalle ?? evento.texto ?? 'Hermes reporto un error');
            break;
          case 'run.completed':
            setParcial('');
            setHerramienta(null);
            setRunActivo(null);
            // Una sola recarga por turno: el transcript real vive en el OS.
            if (!recargado) {
              recargado = true;
              void cargarHilo(conversacionId);
            }
            break;
          default:
            break;
        }
      });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      // El turno puede seguir vivo del lado del server: recargar el hilo deja
      // el run activo a la vista y el polling se encarga del resto.
      if (!recargado) void cargarHilo(conversacionId);
    } finally {
      setStreamAbierto(false);
      setParcial('');
      setHerramienta(null);
    }
  }

  const segundosTrabajando = runActivo
    ? Math.max(0, Math.round((Date.now() - new Date(runActivo.iniciado_at).getTime()) / 1000))
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: '1rem', minHeight: '70vh' }}>
      {/* Lista de conversaciones */}
      <div className="os-card-2" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Dos ejes distintos: QUE agente atiende y DONDE corre. */}
        <select
          value={perfilHermesNuevo}
          onChange={(e) => setPerfilHermesNuevo(e.target.value)}
          className="os-input"
          style={{ fontSize: 12 }}
          title="Que agente de Hermes atiende el tema nuevo (cada uno tiene su propia memoria)"
        >
          {PERFILES_HERMES.map((p) => {
            const salud = saludPerfiles.find((s) => s.id === p.id);
            const sufijo = salud && !salud.configurado ? ' (sin configurar)' : salud && !salud.online ? ' (sin responder)' : '';
            return (
              <option key={p.id} value={p.id}>{`${p.etiqueta}${sufijo}`}</option>
            );
          })}
        </select>
        <select
          value={perfilNuevo}
          onChange={(e) => setPerfilNuevo(e.target.value)}
          className="os-input"
          style={{ fontSize: 12 }}
          title="En que nodo corre el Hermes que atiende el tema nuevo"
        >
          {PERFILES.map((p) => (
            <option key={p.id} value={p.id}>{p.etiqueta}</option>
          ))}
        </select>
        <button type="button" className="os-btn os-btn-primary" onClick={() => void nuevaConversacion()} disabled={cargando}>
          Nueva conversacion
        </button>
        {/* Temas agrupados por agente. El encabezado lleva un punto de estado
            tomado de /api/taski/perfiles: verde responde, gris no. Cada
            conversacion se pinta como `Nombre - dd/mm HH:mm` (ultima
            actividad) con boton de renombrar, mismo formato que la burbuja y
            el cockpit (src/os/lib/sesiones.ts). */}
        {grupos.map((g) => (
          <div key={g.perfil.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            <div
              title={g.salud?.motivo ?? `${g.perfil.etiqueta} responde`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--os-muted)',
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: g.salud?.online ? '#22c55e' : 'var(--os-line)',
                }}
              />
              {g.perfil.etiqueta}
            </div>
            {g.conversaciones.map((c) => {
          const fecha = fechaSesion(new Date(c.updated_at).getTime());
          if (renombrandoId === c.id) {
            return (
              <div key={c.id} style={{ display: 'flex', gap: 4 }}>
                <input
                  autoFocus
                  className="os-input"
                  value={nombreNuevo}
                  disabled={guardandoNombre}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void guardarNombre(c.id);
                    if (e.key === 'Escape') setRenombrandoId(null);
                  }}
                  placeholder="Nombre de la conversacion"
                  style={{ fontSize: 12, padding: '2px 6px', height: 28, flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="os-btn"
                  disabled={guardandoNombre}
                  onClick={() => void guardarNombre(c.id)}
                  style={{ fontSize: 11, padding: '2px 8px', height: 28 }}
                >
                  OK
                </button>
                <button
                  type="button"
                  className="os-btn"
                  onClick={() => setRenombrandoId(null)}
                  style={{ fontSize: 11, padding: '2px 8px', height: 28 }}
                >
                  X
                </button>
              </div>
            );
          }
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: modo === 'os' && c.id === activaId ? 'var(--os-fill-subtle)' : undefined,
                borderRadius: 'var(--os-r-md, 8px)',
              }}
            >
              <button
                type="button"
                className="os-btn"
                onClick={() => {
                  setModo('os');
                  setActivaId(c.id);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  fontSize: 12,
                  background: 'transparent',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
                title={`${c.titulo}${fecha ? ` - ultima actividad ${fecha}` : ''}`}
              >
                {c.titulo}
                {fecha && <span style={{ color: 'var(--os-muted)' }}> · {fecha}</span>}
              </button>
              <button
                type="button"
                title="Renombrar esta conversacion"
                aria-label={`Renombrar ${c.titulo}`}
                onClick={() => {
                  setRenombrandoId(c.id);
                  setNombreNuevo(c.titulo);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--os-muted)',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  edit
                </span>
              </button>
            </div>
          );
            })}
          </div>
        ))}

        {/* Seccion colapsable de solo lectura: sesiones que Hermes guarda en
            el VPS. Pestanas Telegram / OS / Todas (default Todas). */}
        <button
          type="button"
          className="os-btn"
          onClick={() => {
            const abrir = !telegramAbierto;
            setTelegramAbierto(abrir);
            if (abrir && telegramSesiones.length === 0) void cargarSesionesHermes(origenHermes, nodoActivo);
          }}
          style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 8 }}
        >
          <span>Sesiones de Hermes</span>
          <span>{telegramAbierto ? '▾' : '▸'}</span>
        </button>
        {telegramAbierto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['todas', 'telegram', 'os'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    setOrigenHermes(op);
                    void cargarSesionesHermes(op, nodoActivo);
                  }}
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
                    background: origenHermes === op ? 'rgba(59,78,217,0.12)' : 'var(--os-fill-subtle)',
                    border: origenHermes === op ? '1px solid var(--os-accent)' : '1px solid var(--os-line-soft)',
                    color: origenHermes === op ? 'var(--os-accent-light)' : 'var(--os-text-2, var(--os-muted))',
                  }}
                >
                  {op === 'todas' ? 'Todas' : op === 'telegram' ? 'Telegram' : 'OS'}
                </button>
              ))}
            </div>
            {telegramCargandoLista && (
              <span style={{ fontSize: 11, color: 'var(--os-muted)', padding: '2px 6px' }}>Cargando...</span>
            )}
            {!telegramCargandoLista && telegramSesiones.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--os-muted)', padding: '2px 6px' }}>
                Sin sesiones para este filtro.
              </span>
            )}
            {/* `Nombre - dd/mm HH:mm` y el conteo en un chip aparte: antes se
                pegaba al titulo como `(83)`, que se leia como no leidos y no
                lo son (son mensajes acumulados, turnos de herramientas
                incluidos). */}
            {telegramSesiones.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background:
                    modo === 'telegram-readonly' && s.id === telegramActivaId ? 'var(--os-fill-subtle)' : undefined,
                  borderRadius: 'var(--os-r-md, 8px)',
                }}
              >
                <button
                  type="button"
                  className="os-btn"
                  onClick={() => void abrirHiloHermes(s.id, nodoActivo)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    fontSize: 11,
                    background: 'transparent',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                  title={tooltipSesion(s)}
                >
                  {etiquetaSesion(s)}
                </button>
                <span
                  title={`${s.messageCount} mensajes acumulados (incluye turnos de herramientas)`}
                  style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--os-bg-sunken)',
                    color: 'var(--os-muted)',
                    flexShrink: 0,
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
                    flexShrink: 0,
                  }}
                >
                  {s.origen === 'telegram' ? 'TG' : 'OS'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hilo */}
      {modo === 'telegram-readonly' ? (
        <div className="os-card-2" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--os-line-soft)', fontSize: 11, color: 'var(--os-accent)', background: 'var(--os-fill-subtle)' }}>
            Vista de solo lectura -{' '}
            {(() => {
              const s = telegramSesiones.find((x) => x.id === telegramActivaId);
              if (!s) return 'sesion de Hermes';
              return `${s.origen === 'telegram' ? 'conversacion de Telegram' : 'sesion del OS'}: ${nombreSesion(s)}`;
            })()}
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
              <span>
                {etiquetaPerfilHermes(conversacionActiva?.perfil_hermes ?? 'default')}
                {' · '}
                {etiquetaPerfil(conversacionActiva?.perfil ?? 'vps-default')}
              </span>
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

            {/* Burbuja provisional: el texto que va llegando por el stream.
                No se guarda en el estado de mensajes; al cerrar el turno se
                reemplaza por el mensaje real que devuelve /api/chat/:id. */}
            {parcial && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                <div
                  style={{
                    background: 'var(--os-fill-subtle)',
                    border: '1px dashed var(--os-line-soft)',
                    color: 'var(--os-text)',
                    padding: '10px 14px',
                    borderRadius: '14px 14px 14px 2px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {parcial}
                </div>
              </div>
            )}

            {runActivo && !parcial && (
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

          {/* Chip de la herramienta en curso, encima del input */}
          {herramienta && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: '0 1rem',
                padding: '6px 10px',
                borderRadius: 999,
                alignSelf: 'flex-start',
                fontSize: 12,
                color: herramienta.estado === 'fallo' ? 'var(--os-error)' : 'var(--os-muted)',
                background: 'var(--os-fill-subtle)',
                border: `1px solid ${herramienta.estado === 'fallo' ? 'var(--os-error)' : 'var(--os-line-soft)'}`,
              }}
              title={herramienta.detalle ?? undefined}
            >
              {herramienta.estado === 'corriendo' && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '2px solid var(--os-line)',
                    borderTopColor: 'var(--os-accent)',
                    animation: 'taski-spin 0.8s linear infinite',
                  }}
                />
              )}
              {textoHerramienta(herramienta)}
            </div>
          )}

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
              placeholder={runActivo || streamAbierto ? 'Hermes esta trabajando...' : 'Escribe un mensaje'}
              disabled={!activaId || Boolean(runActivo) || streamAbierto}
              className="os-input"
              style={{ flex: 1 }}
            />
            {voiceSupported && (
              <button
                type="button"
                className={isListening ? 'os-btn os-btn-primary' : 'os-btn'}
                title={isListening ? 'Detener dictado por voz' : 'Dictar por voz'}
                onClick={toggleListening}
                disabled={!activaId || Boolean(runActivo)}
              >
                {isListening ? '🔴' : '🎤'}
              </button>
            )}
            <button type="submit" className="os-btn os-btn-primary" disabled={!activaId || Boolean(runActivo) || streamAbierto || !texto.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
