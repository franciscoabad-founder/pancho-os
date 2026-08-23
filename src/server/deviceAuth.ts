// Criptografia del pairing por dispositivo (Fase 2.1).
//
// Este modulo es DELIBERADAMENTE puro: solo node:crypto, ni Supabase ni
// framework. Dos razones:
//
//   1. Se testea con `node --test` sin levantar nada (src/server/deviceAuth.test.ts).
//   2. src/server/osAuth.ts lo necesita, y osAuth.ts esta en el grafo de
//      src/start.ts, que SI se bundlea para el cliente. Todo lo que toque
//      Supabase vive en src/server/devices.handlers.ts, que osAuth.ts importa
//      dinamico (ver el comentario ahi).
//
// Regla del modelo de seguridad, sin excepciones: el token crudo existe en
// memoria el tiempo de una request y viaja UNA vez al dispositivo que se
// empareja. Lo unico que se persiste es su sha256. Un dump de la base no
// alcanza para autenticarse contra el OS.

import { createHash, randomBytes, randomInt } from 'node:crypto';

// 32 bytes = 256 bits de entropia. En base64url son 43 caracteres sin padding,
// copiables y pegables sin escapes (nada de +, / ni =).
export const BYTES_TOKEN = 32;

// Vida de un codigo de pairing. Corta a proposito: el codigo se dicta en voz
// alta o se escanea, no se guarda.
export const PAIRING_TTL_MS = 10 * 60 * 1000;

export const KINDS_DISPOSITIVO = ['desktop', 'android', 'agent', 'browser'] as const;
export type KindDispositivo = (typeof KINDS_DISPOSITIVO)[number];

export function esKindValido(valor: unknown): valor is KindDispositivo {
  return typeof valor === 'string' && (KINDS_DISPOSITIVO as readonly string[]).includes(valor);
}

/** Token crudo nuevo. Se devuelve una sola vez y no se persiste jamas. */
export function generarTokenDispositivo(): string {
  return randomBytes(BYTES_TOKEN).toString('base64url');
}

/** sha256 hex. Es lo unico que va a os_devices.token_hash. */
export function hashTokenDispositivo(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

// randomInt y no Math.random(): el codigo es la unica barrera entre un tercero
// y un token valido durante los 10 minutos de la ventana. randomInt ademas
// evita el sesgo de modulo que tendria `randomBytes(4) % 1000000`.
export function generarCodigoPairing(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function esCodigoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9]{6}$/.test(valor);
}

// Los ids de os_devices y os_pairing_requests son uuid. Validar el formato
// ANTES de mandarlo a Supabase evita que un id basura vuelva como 502 con el
// mensaje crudo de Postgres (22P02, invalid input syntax for type uuid): eso es
// un 400 del cliente, y de paso no le contamos al de afuera con que base
// hablamos.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && RE_UUID.test(valor);
}

/** Normaliza lo que tipea el usuario: espacios, guiones y separadores fuera. */
export function normalizarCodigo(valor: string): string {
  return valor.replace(/[^0-9]/g, '').slice(0, 6);
}

export function expiracionPairing(desde: Date = new Date()): Date {
  return new Date(desde.getTime() + PAIRING_TTL_MS);
}

export function estaVencido(expiresAt: string | Date, ahora: Date = new Date()): boolean {
  const t = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isNaN(t) || t <= ahora.getTime();
}

// --- Custodia del token crudo entre confirm y status -------------------------
//
// El problema: pair/confirm genera el token y pair/status (otra request, la del
// dispositivo que pollea) tiene que entregarlo. Guardarlo en la base romperia
// la regla de arriba, asi que vive en memoria del proceso, con TTL, y se borra
// al entregarse.
//
// Limitacion conocida y aceptada: si PM2 reinicia entre el confirm y el primer
// poll, el token se pierde y hay que repetir el pairing (pair/status responde
// 410 'perdido', no un token invalido). Es una ventana de segundos y el proceso
// `pancho-os` corre en instancia unica; el dia que se pase a modo cluster hay
// que mover esto a algo compartido (Redis o una columna cifrada), no a texto
// plano en Postgres.
type TokenEnCustodia = { token: string; expiraEn: number };
const custodia = new Map<string, TokenEnCustodia>();

function limpiarCustodia(ahora: number): void {
  for (const [id, entrada] of custodia) {
    if (entrada.expiraEn <= ahora) custodia.delete(id);
  }
}

export function guardarTokenEnCustodia(pairingId: string, token: string): void {
  const ahora = Date.now();
  limpiarCustodia(ahora);
  custodia.set(pairingId, { token, expiraEn: ahora + PAIRING_TTL_MS });
}

/** Devuelve el token y lo saca de la custodia: solo se puede reclamar una vez. */
export function reclamarTokenEnCustodia(pairingId: string): string | undefined {
  const ahora = Date.now();
  limpiarCustodia(ahora);
  const entrada = custodia.get(pairingId);
  if (!entrada) return undefined;
  custodia.delete(pairingId);
  return entrada.token;
}

/** Solo para tests: deja la custodia vacia entre casos. */
export function vaciarCustodia(): void {
  custodia.clear();
}

// --- Limite de frecuencia de pair/start --------------------------------------
//
// pair/start es publico por necesidad (el dispositivo que se empareja todavia
// no tiene credencial), o sea que es el unico endpoint del OS que escribe en la
// base sin autenticar. Sin freno, cualquiera desde internet puede inflar
// os_pairing_requests indefinidamente, y peor: ocupando codigos vivos puede
// hacer que los pair/start legitimos se queden sin codigo libre.
//
// Ventana deslizante en memoria del proceso. Suficiente y proporcionado:
//   - `pancho-os` corre en PM2 en instancia unica, asi que el contador es
//     global de verdad. El dia que se pase a cluster hay que moverlo a Redis
//     junto con la custodia de tokens (mismo comentario, mismo dia).
//   - Un reinicio borra el contador. Es un limite anti abuso, no un cupo
//     contable; perder la ventana cada tanto no cambia nada.
//   - No reemplaza al tope global de solicitudes vivas que verifica
//     devices.handlers.ts contra la base: este frena a un cliente insistente,
//     aquel frena a una botnet repartida.
export const PAIRING_MAX_POR_CLIENTE = 10;
export const PAIRING_VENTANA_MS = 10 * 60 * 1000;
// Techo de claves distintas. Existe solo para que un atacante que rota IPs no
// convierta el limitador en una fuga de memoria.
const PAIRING_MAX_CLAVES = 4096;

// Cada cuanto se barre la tabla entera. La decision de permitir o no NUNCA
// depende de este barrido (la ventana del cliente que llama se recalcula en
// cada llamada); el barrido existe solo para que el Map no se quede con claves
// muertas. Amortizarlo asi deja el camino caliente en O(1) en vez de O(claves).
const PAIRING_INTERVALO_BARRIDO_MS = 30 * 1000;

const intentosPorCliente = new Map<string, number[]>();
let ultimoBarrido = 0;

function barrerSiToca(ahora: number, desde: number): void {
  if (ahora - ultimoBarrido < PAIRING_INTERVALO_BARRIDO_MS) return;
  ultimoBarrido = ahora;
  for (const [k, sellos] of intentosPorCliente) {
    if (sellos.every((t) => t <= desde)) intentosPorCliente.delete(k);
  }
}

/**
 * Registra un intento de pair/start y dice si se permite.
 * `false` = el cliente ya paso PAIRING_MAX_POR_CLIENTE en la ventana.
 */
export function permitirPairing(clave: string, ahora: number = Date.now()): boolean {
  const desde = ahora - PAIRING_VENTANA_MS;
  barrerSiToca(ahora, desde);

  // La ventana del que llama se recalcula siempre, sin depender del barrido:
  // eso es lo que hace que la decision sea exacta.
  const propios = (intentosPorCliente.get(clave) ?? []).filter((t) => t > desde);
  if (propios.length >= PAIRING_MAX_POR_CLIENTE) {
    intentosPorCliente.set(clave, propios);
    return false;
  }

  // Techo duro de claves. Se desaloja la mas antigua en vez de rechazar:
  // rechazar por presion de memoria le daria a un atacante con IPs rotativas
  // una forma de bloquear el pairing legitimo, que es justo lo que este
  // limitador viene a evitar.
  if (!intentosPorCliente.has(clave) && intentosPorCliente.size >= PAIRING_MAX_CLAVES) {
    const primera = intentosPorCliente.keys().next();
    if (!primera.done) intentosPorCliente.delete(primera.value);
  }

  propios.push(ahora);
  intentosPorCliente.set(clave, propios);
  return true;
}

/** Solo para tests: deja el limitador en cero entre casos. */
export function vaciarLimitePairing(): void {
  intentosPorCliente.clear();
  ultimoBarrido = 0;
}
