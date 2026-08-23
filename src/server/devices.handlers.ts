// Logica de negocio del pairing por dispositivo: todo lo que toca Supabase.
//
// Mismo patron que src/server/tareas.handlers.ts: aca no hay Request, Response
// ni framework. Los errores de negocio viajan como ErrorDispositivos con su
// status HTTP y el server route (src/routes/api/os-auth/**) los traduce.
//
// La cripto vive aparte, en src/server/deviceAuth.ts, para que src/server/osAuth.ts
// pueda usarla sin arrastrar @supabase/supabase-js al grafo del cliente.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import {
  esKindValido,
  esUuid,
  estaVencido,
  expiracionPairing,
  generarCodigoPairing,
  generarTokenDispositivo,
  guardarTokenEnCustodia,
  hashTokenDispositivo,
  permitirPairing,
  reclamarTokenEnCustodia,
  type KindDispositivo,
} from './deviceAuth.ts';

export const TABLA_DEVICES = 'os_devices';
export const TABLA_PAIRING = 'os_pairing_requests';

// Seam para tests, mismo patron que setVerificadorDispositivo en osAuth.ts: en
// produccion siempre resuelve a getSupabaseServer(); los tests inyectan un
// doble en memoria y no tocan Supabase real.
let clienteActual: () => SupabaseClient = getSupabaseServer;

/** Solo para tests: inyecta un cliente Supabase (o doble) distinto. */
export function setClienteSupabaseDevices(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface Dispositivo {
  id: string;
  label: string;
  kind: KindDispositivo;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_via: string | null;
}

export class ErrorDispositivos extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ErrorDispositivos';
    this.status = status;
  }
}

// Etiqueta por defecto cuando el dispositivo no manda una. Nunca vacia: label
// es not null en la tabla y una lista de dispositivos sin nombre es inutil.
const ETIQUETA_POR_DEFECTO: Record<KindDispositivo, string> = {
  desktop: 'Escritorio sin nombre',
  android: 'Android sin nombre',
  agent: 'Agente sin nombre',
  browser: 'Navegador sin nombre',
};

function normalizarLabel(valor: unknown, kind: KindDispositivo): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  // 80 caracteres: entra en una fila de la tabla sin romper el layout.
  return texto ? texto.slice(0, 80) : ETIQUETA_POR_DEFECTO[kind];
}

function exigirKind(valor: unknown): KindDispositivo {
  if (!esKindValido(valor)) {
    throw new ErrorDispositivos("kind invalido: usa desktop, android, agent o browser", 400);
  }
  return valor;
}

// --- pair/start --------------------------------------------------------------

export interface SolicitudPairing {
  device_id: string;
  code: string;
  expires_at: string;
}

// Tope de solicitudes de pairing abiertas y no vencidas en TODO el sistema.
// Pancho empareja de a un dispositivo; 30 vivas al mismo tiempo ya es abuso, no
// uso. Es el freno que el limite por cliente no puede dar: contra muchas IPs
// distintas el unico numero que importa es el total.
export const MAX_PAIRINGS_VIVOS = 30;

// Cuanto se conserva una solicitud vencida y nunca confirmada antes de
// purgarla. No es cero porque durante esa hora consultarPairing puede decir
// "vencio" en vez de "no existe", que es un mensaje bastante mas util para el
// que esta emparejando. Pasada la hora ya no le sirve a nadie y ademas su
// codigo sigue ocupado por el indice unico parcial.
const GRACIA_PURGA_MS = 60 * 60 * 1000;
// La purga es un DELETE por request si no se acota; con esto corre como mucho
// una vez por minuto por proceso.
const INTERVALO_PURGA_MS = 60 * 1000;
let ultimaPurga = 0;

/** Solo para tests: fuerza que la proxima purga corra. */
export function resetearPurga(): void {
  ultimaPurga = 0;
}

// Best-effort de verdad: si la purga falla (tabla sin migrar, permisos), el
// pairing tiene que seguir funcionando. Es higiene, no parte del contrato.
async function purgarPairingsVencidos(sb: SupabaseClient): Promise<void> {
  const ahora = Date.now();
  if (ahora - ultimaPurga < INTERVALO_PURGA_MS) return;
  ultimaPurga = ahora;
  try {
    await sb
      .from(TABLA_PAIRING)
      .delete()
      .is('confirmed_at', null)
      .lt('expires_at', new Date(ahora - GRACIA_PURGA_MS).toISOString());
  } catch {
    // Silencio deliberado.
  }
}

// Postgres 23505 = unique_violation. Los errores de supabase-js llegan como
// objetos planos con `code`, no como instancias de Error.
function esCodigoDuplicado(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

export interface OpcionesPairing {
  /** Identidad aproximada de quien llama, para el limite de frecuencia. */
  clienteId?: string;
}

export async function iniciarPairing(
  cuerpo: Record<string, unknown>,
  opciones: OpcionesPairing = {},
): Promise<SolicitudPairing> {
  // Validar ANTES de abrir el cliente: un kind invalido tiene que responder 400
  // aunque Supabase no este configurado, no un 502 que confunde el diagnostico.
  const kind = exigirKind(cuerpo.kind);
  const label = normalizarLabel(cuerpo.label, kind);

  // Y el limite por cliente antes de tocar la base: el punto de un limite de
  // frecuencia es no gastar la base en quien abusa.
  if (!permitirPairing(opciones.clienteId ?? 'desconocido')) {
    throw new ErrorDispositivos('demasiadas solicitudes de emparejamiento, espera unos minutos', 429);
  }

  const sb = clienteActual();
  await purgarPairingsVencidos(sb);

  const ahora = new Date().toISOString();
  const { data: vivas, error: errorVivas } = await sb
    .from(TABLA_PAIRING)
    .select('id')
    .is('confirmed_at', null)
    .gt('expires_at', ahora)
    .limit(MAX_PAIRINGS_VIVOS + 1);
  if (errorVivas) throw errorVivas;
  if ((vivas?.length ?? 0) > MAX_PAIRINGS_VIVOS) {
    throw new ErrorDispositivos('hay demasiados emparejamientos abiertos, espera a que venzan', 429);
  }

  const expiresAt = expiracionPairing().toISOString();

  // Insertar y reintentar, en vez de consultar si el codigo esta libre y
  // despues insertar. La version con SELECT previo era una carrera (dos
  // pair/start concurrentes podian quedarse con el mismo codigo vivo) y ademas
  // amplificaba: hasta 6 consultas por request contra un endpoint publico.
  // Ahora la unicidad la garantiza os_pairing_requests_code_abierto_idx y esto
  // solo reacciona al 23505.
  for (let intento = 0; intento < 8; intento++) {
    const { data, error } = await sb
      .from(TABLA_PAIRING)
      .insert([{ code: generarCodigoPairing(), kind, label, expires_at: expiresAt }])
      .select('id, code, expires_at')
      .single();

    if (!error) {
      return {
        device_id: data.id as string,
        code: data.code as string,
        expires_at: data.expires_at as string,
      };
    }
    if (!esCodigoDuplicado(error)) throw error;
  }

  // 8 colisiones seguidas sobre 10^6 codigos con un maximo de 30 vivos es
  // imposible en la practica: si pasa, algo esta mal de verdad y es mejor
  // fallar fuerte que entregar un codigo ambiguo.
  throw new ErrorDispositivos('no se pudo generar un codigo libre, reintenta', 503);
}

// --- pair/status -------------------------------------------------------------

export type EstadoPairing =
  | { status: 'pending'; expires_at: string }
  | { status: 'confirmed'; token: string; label: string; kind: KindDispositivo };

export async function consultarPairing(deviceId: string | null): Promise<EstadoPairing> {
  if (!deviceId) throw new ErrorDispositivos('device_id requerido', 400);
  // Es un uuid o no es nada: sin esto, un id basura vuelve como 502 con el
  // texto de Postgres (22P02) desde un endpoint publico.
  if (!esUuid(deviceId)) throw new ErrorDispositivos('device_id invalido', 400);

  const sb = clienteActual();
  const { data, error } = await sb
    .from(TABLA_PAIRING)
    .select('id, kind, label, token_hash, expires_at, confirmed_at, delivered_at')
    .eq('id', deviceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ErrorDispositivos('solicitud de pairing no encontrada', 404);

  if (data.delivered_at) {
    throw new ErrorDispositivos('el token de esta solicitud ya fue entregado, repeti el pairing', 410);
  }

  if (!data.confirmed_at) {
    if (estaVencido(data.expires_at as string)) {
      throw new ErrorDispositivos('la solicitud de pairing vencio, pedi un codigo nuevo', 410);
    }
    return { status: 'pending', expires_at: data.expires_at as string };
  }

  // Confirmada y sin entregar: la entrega es de una sola vez. El `is('delivered_at', null)`
  // hace de candado: si dos polls llegan juntos, uno actualiza cero filas y se
  // va con 410 en vez de que los dos se lleven el token.
  const entregadoEn = new Date().toISOString();
  const { data: marcadas, error: errorMarca } = await sb
    .from(TABLA_PAIRING)
    .update({ delivered_at: entregadoEn })
    .eq('id', deviceId)
    .is('delivered_at', null)
    .select('id');
  if (errorMarca) throw errorMarca;
  if (!marcadas || marcadas.length === 0) {
    throw new ErrorDispositivos('el token de esta solicitud ya fue entregado, repeti el pairing', 410);
  }

  const token = reclamarTokenEnCustodia(deviceId);
  if (!token) {
    // Ver el comentario de custodia en deviceAuth.ts: el token crudo vive en
    // memoria del proceso. Si PM2 reinicio entre el confirm y este poll, se
    // perdio y nadie lo va a poder usar nunca.
    //
    // El os_devices asociado quedaria entonces activo con un token que no
    // existe: una credencial fantasma en la lista de auditoria. Se revoca sola,
    // aca mismo. Best-effort: si la revocacion falla igual devolvemos el 410,
    // porque lo que el dispositivo necesita saber es que tiene que repetir el
    // pairing.
    await revocarPorTokenHash(sb, data.token_hash as string | null);
    throw new ErrorDispositivos(
      'el token se perdio (reinicio del servidor entre la confirmacion y el poll), repeti el pairing',
      410,
    );
  }

  return {
    status: 'confirmed',
    token,
    label: (data.label as string | null) ?? '',
    kind: data.kind as KindDispositivo,
  };
}

/**
 * Revoca el dispositivo que nacio de un pairing cuyo token quedo huerfano.
 * Se traga los errores: es limpieza, no parte de ninguna respuesta.
 */
async function revocarPorTokenHash(sb: SupabaseClient, tokenHash: string | null): Promise<void> {
  if (!tokenHash) return;
  try {
    await sb
      .from(TABLA_DEVICES)
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null);
  } catch {
    // Silencio deliberado.
  }
}

// --- pair/confirm ------------------------------------------------------------

export interface ResultadoConfirmacion {
  id: string;
  label: string;
  kind: KindDispositivo;
}

export async function confirmarPairing(code: unknown): Promise<ResultadoConfirmacion> {
  if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
    throw new ErrorDispositivos('code invalido: se esperan 6 digitos', 400);
  }

  const sb = clienteActual();
  const ahora = new Date();
  // limit(2), no limit(1): hay que poder DETECTAR la ambiguedad, no elegir una.
  const { data, error } = await sb
    .from(TABLA_PAIRING)
    .select('id, kind, label, expires_at, confirmed_at')
    .eq('code', code)
    .is('confirmed_at', null)
    .gt('expires_at', ahora.toISOString())
    .limit(2);
  if (error) throw error;

  // Con os_pairing_requests_code_abierto_idx aplicado esto no puede pasar. Si
  // la migracion no se corrio, si: dos pair/start concurrentes pueden dejar dos
  // solicitudes vivas con el mismo codigo. La version anterior de este handler
  // resolvia el empate con `order created_at desc limit 1`, o sea se quedaba
  // con la MAS NUEVA, y eso es exactamente lo que necesita un atacante que
  // spamea pair/start durante la ventana: Pancho confirma sin saberlo la
  // solicitud del atacante, que despues reclama el token con su propio
  // device_id. Ante ambiguedad no se elige: se falla y Pancho genera otro.
  if ((data?.length ?? 0) > 1) {
    throw new ErrorDispositivos(
      'hay mas de una solicitud viva con ese codigo; no se confirma ninguna, genera un codigo nuevo',
      409,
    );
  }

  const solicitud = data?.[0];
  if (!solicitud) {
    // Mismo mensaje para "no existe" y para "vencida": no le damos a quien
    // prueba codigos la pista de cuales existieron.
    throw new ErrorDispositivos('codigo invalido o vencido', 404);
  }

  const kind = solicitud.kind as KindDispositivo;
  const label = normalizarLabel(solicitud.label, kind);
  const token = generarTokenDispositivo();
  const tokenHash = hashTokenDispositivo(token);

  // Primero el dispositivo: si esto falla, la solicitud queda pendiente y se
  // puede reintentar. Al reves quedaria una solicitud confirmada sin dispositivo.
  const { data: device, error: errorDevice } = await sb
    .from(TABLA_DEVICES)
    .insert([{ label, kind, token_hash: tokenHash, created_via: 'pairing' }])
    .select('id, label, kind')
    .single();
  if (errorDevice) throw errorDevice;

  const { error: errorSolicitud } = await sb
    .from(TABLA_PAIRING)
    .update({ token_hash: tokenHash, confirmed_at: ahora.toISOString() })
    .eq('id', solicitud.id)
    .is('confirmed_at', null);
  if (errorSolicitud) throw errorSolicitud;

  // Recien aca el token crudo queda disponible para pair/status, y solo en
  // memoria. Ninguna respuesta de confirm lo devuelve.
  guardarTokenEnCustodia(solicitud.id as string, token);

  return { id: device.id as string, label: device.label as string, kind: device.kind as KindDispositivo };
}

// --- listado y revocacion ----------------------------------------------------

export async function listarDispositivos(): Promise<Dispositivo[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from(TABLA_DEVICES)
    .select('id, label, kind, created_at, last_seen_at, revoked_at, created_via')
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dispositivo[];
}

export async function revocarDispositivo(id: string | null | undefined): Promise<Dispositivo> {
  if (!id) throw new ErrorDispositivos('id requerido', 400);
  // Igual que en consultarPairing: un id que no es uuid es un 400 del cliente,
  // no un 502 con el mensaje de Postgres reenviado tal cual.
  if (!esUuid(id)) throw new ErrorDispositivos('id invalido', 400);

  const sb = clienteActual();
  // revoked_at se setea una sola vez: revocar dos veces no debe mover la fecha
  // original, que es el dato de auditoria.
  const { data, error } = await sb
    .from(TABLA_DEVICES)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)
    .select('id, label, kind, created_at, last_seen_at, revoked_at, created_via');
  if (error) throw error;

  const fila = data?.[0];
  if (fila) return fila as Dispositivo;

  // Cero filas: o no existe, o ya estaba revocado. Se distingue con una lectura.
  const { data: existente, error: errorLectura } = await sb
    .from(TABLA_DEVICES)
    .select('id, label, kind, created_at, last_seen_at, revoked_at, created_via')
    .eq('id', id)
    .maybeSingle();
  if (errorLectura) throw errorLectura;
  if (!existente) throw new ErrorDispositivos('dispositivo no encontrado', 404);
  return existente as Dispositivo;
}

// --- verificacion de token (la usa isOsAuthorized) ---------------------------

/**
 * Busca el token en os_devices por su hash. Devuelve el id del dispositivo si
 * vale, o null. NO lanza por tabla inexistente ni por Supabase caido: quien
 * llama (src/server/osAuth.ts) necesita que este camino falle en silencio hacia
 * "no autorizado", sin tumbar la cookie ni OS_API_TOKENS.
 */
export async function verificarTokenDispositivo(token: string): Promise<string | null> {
  try {
    const sb = clienteActual();
    const { data, error } = await sb
      .from(TABLA_DEVICES)
      .select('id')
      .eq('token_hash', hashTokenDispositivo(token))
      .is('revoked_at', null)
      .maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

/**
 * Marca el uso. Best-effort de verdad: un fallo aca no puede revertir una
 * autorizacion ya concedida, asi que se traga cualquier error.
 */
export async function tocarUltimoUso(deviceId: string): Promise<void> {
  try {
    const sb = clienteActual();
    await sb.from(TABLA_DEVICES).update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId);
  } catch {
    // Silencio deliberado.
  }
}
