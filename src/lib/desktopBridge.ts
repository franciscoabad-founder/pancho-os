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

// ---------------------------------------------------------------------------
// Hermes (agente personal, via A2A)
// ---------------------------------------------------------------------------
// Hermes corre en la laptop como proceso aparte y expone un servidor A2A
// (Agent2Agent) en su IP de Tailscale. El escritorio lo consume como cliente.
// Los comandos de Rust viven en src-tauri/src/hermes.rs, que documenta arriba de
// todo los pasos de configuracion que Pancho tiene que hacer a mano.
//
// PENDIENTE DE CONFIGURACION: hasta que Pancho cree el token de peer del OS en
// el .env de Hermes y lo pegue en el archivo de config local, hermesA2ACall()
// va a devolver siempre { ok: false, error: { codigo: 'hermes_sin_token' } }.
// Eso es el estado inicial esperado, NO un bug: el mensaje de ese error trae la
// ruta exacta del archivo que falta crear, asi que la UI puede mostrarlo tal
// cual y ser accionable sin hardcodear ninguna ruta aca.

export type HermesErrorCode =
  | 'hermes_sin_token'
  | 'hermes_config_invalida'
  | 'hermes_no_alcanzable'
  | 'hermes_timeout'
  | 'hermes_no_autorizado'
  | 'hermes_rpc'
  | 'hermes_http'
  | 'hermes_respuesta_invalida'
  | 'hermes_cliente'
  | 'sin_escritorio'
  | 'desconocido';

export type HermesError = {
  codigo: HermesErrorCode;
  mensaje: string;
  status?: number;
  // Codigo JSON-RPC crudo cuando codigo === 'hermes_rpc'.
  rpc_code?: number;
};

export type HermesResult<T> = { ok: true; data: T } | { ok: false; error: HermesError };

// True cuando Hermes todavia no esta configurado del lado del OS. La UI deberia
// tratarlo como "falta setup" (mostrar el mensaje, que trae la ruta del archivo)
// y no como "Hermes fallo": no hay nada roto, falta un paso manual.
export function hermesFaltaConfigurar(error: HermesError): boolean {
  return error.codigo === 'hermes_sin_token' || error.codigo === 'hermes_config_invalida';
}

// True cuando la tarea pudo haber quedado corriendo del lado de Hermes pese al
// error. Mismo criterio que flowPuedeSeguirEnCurso y por el mismo motivo, pero
// aca importa mas: Hermes tiene skill de terminal, asi que un reintento a ciegas
// puede ejecutar dos veces algo que ya se ejecuto. Ante esto NO reintentar solo.
export function hermesPuedeSeguirEnCurso(error: HermesError): boolean {
  return error.codigo === 'hermes_timeout';
}

// Mensaje corto y listo para mostrar. Los errores de config y de auth ya vienen
// redactados desde Rust con los pasos concretos, asi que se pasan tal cual: son
// el unico caso donde el texto largo es exactamente lo que el usuario necesita.
export function hermesErrorTexto(error: HermesError): string {
  if (error.codigo === 'hermes_no_alcanzable') {
    return 'Hermes no responde. Revisa que este corriendo y que Tailscale este conectado.';
  }
  if (error.codigo === 'hermes_timeout') {
    return 'Hermes tardo demasiado. Puede seguir trabajando: revisa antes de reintentar.';
  }
  if (error.codigo === 'sin_escritorio') return 'Disponible solo en la app de escritorio.';
  return error.mensaje;
}

async function invocarHermes<T>(
  comando: string,
  args?: Record<string, unknown>,
): Promise<HermesResult<T>> {
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
    if (err && typeof err === 'object' && 'codigo' in err) {
      return { ok: false, error: err as HermesError };
    }
    return { ok: false, error: { codigo: 'desconocido', mensaje: String(err) } };
  }
}

// El agent card es un documento del estandar A2A que sirve Hermes. Se deja
// abierto a proposito: es de otro repo y trae mas campos de los que usamos.
export type HermesAgentCard = {
  name: string;
  description?: string;
  version?: string;
  supportedInterfaces?: Array<{ url?: string; protocolBinding?: string; protocolVersion?: string }>;
  capabilities?: Record<string, unknown>;
  skills?: Array<{ id: string; name: string; description?: string; tags?: string[] }>;
  [k: string]: unknown;
};

// Estado de la tarea en A2A v1.0. Se deja como string abierto porque el set lo
// define Hermes y puede crecer.
export type HermesTaskState =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_AUTH_REQUIRED'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_REJECTED'
  | (string & {});

export type HermesRespuesta = {
  taskId: string;
  // Guardarlo y pasarlo en la siguiente llamada continua el mismo hilo: Hermes
  // persiste la conversacion por contextId.
  contextId: string;
  estado: HermesTaskState;
  texto: string;
  // El result crudo del JSON-RPC, por si hace falta algo que Rust no extrajo.
  crudo: unknown;
};

// Tipo tal como lo serializa Rust (snake_case). Se traduce abajo para no
// mezclar convenciones en el resto del frontend.
type HermesRespuestaRust = {
  task_id: string;
  context_id: string;
  estado: string;
  texto: string;
  crudo: unknown;
};

// GET /.well-known/agent.json. El card es publico: no necesita token, asi que
// esto funciona ANTES de que Pancho configure nada. Por eso es la forma correcta
// de saber si Hermes esta arriba, y de separar "no hay red" de "falta el token".
export function hermesAgentCard(): Promise<HermesResult<HermesAgentCard>> {
  return invocarHermes<HermesAgentCard>('hermes_agent_card');
}

// POST JSON-RPC message/send contra el A2A de Hermes.
//
// OJO: bloquea hasta que Hermes termina de pensar, hasta 315s. No es
// fire-and-forget. La UI tiene que mostrar que esta esperando, y no debe
// reintentar automaticamente: Hermes tiene skill de terminal y un reintento
// puede ejecutar dos veces algo que ya corrio.
//
// Para elegir capacidad (terminal, spotify) se pide EN EL TEXTO. A2A no tiene
// campo para seleccionar skill: las skills del agent card son publicidad, no
// ruteo. Ver el comentario largo en src-tauri/src/hermes.rs.
export async function hermesA2ACall(
  mensaje: string,
  contextId?: string,
): Promise<HermesResult<HermesRespuesta>> {
  const r = await invocarHermes<HermesRespuestaRust>('hermes_a2a_call', {
    mensaje,
    contextId: contextId ?? null,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      taskId: r.data.task_id,
      contextId: r.data.context_id,
      estado: r.data.estado,
      texto: r.data.texto,
      crudo: r.data.crudo,
    },
  };
}
