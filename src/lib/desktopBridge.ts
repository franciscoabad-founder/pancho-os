// Puente hacia el shell de escritorio (Tauri, Fase 2 del plan de migracion).
// Ver C:\Users\Francisco\.claude-rafik\plans\ok-entonces-lo-que-sharded-petal.md
//
// Detecta si la UI corre dentro de la ventana nativa de Tauri (src-tauri/) o
// en un navegador normal / PWA. En navegador, isDesktop() da false y las
// funciones de este archivo nunca se llaman -- el resto del OS sigue
// funcionando exactamente igual que hoy, cero regresion. Solo cuando corre
// dentro de la app de escritorio estas funciones invocan comandos reales de
// Rust via @tauri-apps/api.
//
// IMPORTANTE: cada funcion de aca abajo asume que el comando de Rust
// correspondiente YA existe en src-tauri/src/. Si todavia no se escribio ese
// comando (ver el estado real en src-tauri/src/lib.rs), la funcion debe
// documentarlo con un comentario "TODO Fase 2.x" en vez de fingir que existe.

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type OllamaStatus =
  | { disponible: true; modelos: string[] }
  | { disponible: false; error: string };

// Ping a Ollama (local o via Tailscale, ver ollama.rs) para saber si el
// asistente de escritorio puede usarlo. Comando Rust: "ollama_status"
// (Fase 2.1 del plan, src-tauri/src/ollama.rs).
export async function ollamaStatus(): Promise<OllamaStatus> {
  if (!isDesktop()) return { disponible: false, error: 'No corre en la app de escritorio.' };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<OllamaStatus>('ollama_status');
}

// ---------------------------------------------------------------------------
// Flow (dictado y reuniones)
// ---------------------------------------------------------------------------
// Flow es la app local de Pancho (C:\DEV\Flow, Python/FastAPI en el puerto
// 5000) que ya resuelve captura de audio, hotkeys y transcripcion. El
// escritorio NO reimplementa nada de eso: la consume como cliente. Los comandos
// de Rust viven en src-tauri/src/flow.rs.
//
// Contrato: cada funcion devuelve { ok: true, data } o { ok: false, error }.
// Nunca lanza. Asi la UI puede pintar "Flow no esta corriendo" sin try/catch
// en cada pantalla.

// flow_no_corriendo y flow_timeout son cosas distintas a proposito: la primera
// es "Flow esta apagado, abrilo"; la segunda es "Flow esta abierto pero ocupado".
// Confundirlas hacia que cortar una reunion larga (Flow tarda, esta mezclando
// cientos de MB de audio) le dijera al usuario que Flow no corria, justo cuando
// lo peor que puede hacer es reiniciarlo.
export type FlowErrorCode =
  | 'flow_no_corriendo'
  | 'flow_timeout'
  | 'flow_http'
  | 'flow_respuesta_invalida'
  | 'flow_cliente'
  | 'sin_escritorio'
  | 'desconocido';

export type FlowError = {
  codigo: FlowErrorCode;
  mensaje: string;
  status?: number;
};

export type FlowResult<T> = { ok: true; data: T } | { ok: false; error: FlowError };

// True cuando la accion pudo haber quedado en curso del lado de Flow pese al
// error. En ese caso la UI no debe declarar que fallo: debe reconsultar con
// flowRecordingStatus() antes de ofrecer un reintento.
export function flowPuedeSeguirEnCurso(error: FlowError): boolean {
  return error.codigo === 'flow_timeout';
}

// Mensaje corto y listo para mostrar en la UI.
export function flowErrorTexto(error: FlowError): string {
  if (error.codigo === 'flow_no_corriendo') return 'Flow no esta corriendo.';
  if (error.codigo === 'flow_timeout') {
    return 'Flow esta tardando en responder. Sigue trabajando, no lo cierres.';
  }
  if (error.codigo === 'sin_escritorio') return 'Disponible solo en la app de escritorio.';
  // Flow contesta 409 cuando el id que mandamos no es la grabacion activa y 400
  // cuando no hubo audio. Volcar su JSON crudo en pantalla no le sirve a nadie.
  if (error.codigo === 'flow_http' && error.status === 409) {
    return 'Esa reunion ya no es la grabacion activa en Flow.';
  }
  if (error.codigo === 'flow_http' && error.status === 400) {
    return 'Flow rechazo la accion. Revisa si ya hay una grabacion en curso.';
  }
  return error.mensaje;
}

// Envoltorio unico: valida que estemos en escritorio, invoca y normaliza el
// error tipado que devuelve flow.rs.
async function invocarFlow<T>(comando: string, args?: Record<string, unknown>): Promise<FlowResult<T>> {
  if (!isDesktop()) {
    return {
      ok: false,
      error: { codigo: 'sin_escritorio', mensaje: 'No corre en la app de escritorio.' },
    };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const data = await invoke<T>(comando, args);
    return { ok: true, data };
  } catch (err) {
    // flow.rs devuelve Err(FlowError), que llega aca como objeto plano.
    if (err && typeof err === 'object' && 'codigo' in err) {
      return { ok: false, error: err as FlowError };
    }
    return { ok: false, error: { codigo: 'desconocido', mensaje: String(err) } };
  }
}

// Los tipos de abajo describen solo los campos que el OS usa hoy. Flow es otro
// repo y su respuesta trae mas cosas: se dejan abiertas a proposito para que un
// campo nuevo del lado de Flow no rompa nada aca.

export type FlowHealth = {
  whisper_ready?: boolean;
  recording?: boolean;
  ollama?: { reachable?: boolean; model?: string };
  dictation?: { listener_alive?: boolean; recording?: boolean; hotkey?: string };
  [k: string]: unknown;
};

export type FlowDictation = {
  id: number;
  text: string;
  created_at: string;
  source?: string;
  app_target?: string | null;
  duration_seconds?: number;
  word_count?: number;
  [k: string]: unknown;
};

export type FlowDictationInbox = {
  total: number;
  offset: number;
  limit: number;
  items: FlowDictation[];
};

export type FlowMeeting = {
  id: number;
  title: string;
  created_at: string;
  duration_seconds?: number;
  status?: string;
  has_summary?: boolean;
  has_notes?: boolean;
  [k: string]: unknown;
};

export type FlowStartRecordingResponse = {
  meeting_id: number;
  status?: string;
  channels?: string;
  mic_label?: string;
  system_label?: string;
  [k: string]: unknown;
};

export type FlowStopRecordingResponse = {
  status?: string;
  duration?: number;
  channel_errors?: unknown;
  [k: string]: unknown;
};

export type FlowRecordingStatus = {
  is_recording: boolean;
  active_meeting_id: number | null;
  elapsed?: number;
  last_error?: string | null;
  [k: string]: unknown;
};

// GET /api/system/health. Sirve de ping para saber si Flow esta arriba.
export function flowHealth(): Promise<FlowResult<FlowHealth>> {
  return invocarFlow<FlowHealth>('flow_health');
}

// GET /api/dictation/inbox. limit se acota del lado de Rust (1..200, default 20).
export function flowListDictations(limit?: number): Promise<FlowResult<FlowDictationInbox>> {
  return invocarFlow<FlowDictationInbox>('flow_list_dictations', { limit: limit ?? null });
}

// GET /api/meetings. Ojo: Flow devuelve un arreglo directo, no un objeto.
export function flowListMeetings(): Promise<FlowResult<FlowMeeting[]>> {
  return invocarFlow<FlowMeeting[]>('flow_list_meetings');
}

// GET /api/meetings/recording-status.
export function flowRecordingStatus(): Promise<FlowResult<FlowRecordingStatus>> {
  return invocarFlow<FlowRecordingStatus>('flow_recording_status');
}

// POST /api/meetings/start-recording (mic + audio del sistema). El meeting_id
// que devuelve es el que hay que guardar para despues cortar la grabacion.
export function flowStartRecording(): Promise<FlowResult<FlowStartRecordingResponse>> {
  return invocarFlow<FlowStartRecordingResponse>('flow_start_recording');
}

// POST /api/meetings/stop-recording/{mid}. El id de Flow es numerico; se acepta
// number o string y se manda como string, que es lo que espera el comando.
//
// Esta es la llamada lenta: Flow corta la transcripcion en vivo y mezcla los
// canales antes de contestar, y en una reunion de horas eso se mide en decenas
// de segundos. Del lado de Rust tiene 120s de presupuesto. Si aun asi devuelve
// un error con flowPuedeSeguirEnCurso() true, NO es un fallo: hay que sondear
// flowRecordingStatus() hasta ver is_recording en false.
export function flowStopRecording(
  meetingId: number | string,
): Promise<FlowResult<FlowStopRecordingResponse>> {
  return invocarFlow<FlowStopRecordingResponse>('flow_stop_recording', {
    meetingId: String(meetingId),
  });
}
