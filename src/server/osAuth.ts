// Bridge de autenticacion del OS, portado de src/os/lib/osAuth.ts (Astro) a
// TanStack Start.
//
// Diferencia clave con la version Astro: aca NO dependemos de APIContext ni de
// helpers de contexto ambiente del framework. Todo recibe un `Request`
// explicito, asi el modulo queda puro y se puede usar desde los tres lugares:
//
//   - middleware de request (recibe `request` en las opciones)
//   - server routes de src/routes/api/** (reciben `request` en el handler)
//   - server functions: `await isOsAuthorized(getRequest())`, con `getRequest`
//     importado de '@tanstack/react-start/server' en el propio server fn
//
// Mantenerlo puro tambien evita que un import de '@tanstack/react-start/server'
// se cuele en el grafo del cliente cuando el middleware global se registra
// desde src/start.ts (ese archivo si se bundlea para el cliente).

import { esTokenValido } from '../lib/osTokens.ts';
import { readEnv } from '../lib/env.ts';

// Nombre y vida de la cookie de sesion del navegador. Iguales a los de la
// version Astro: cambiarlos desloguea a todo el mundo.
export const OS_AUTH_COOKIE = 'os_auth';
export const OS_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

// Parseo minimo del header Cookie. No usamos getCookie() del framework a
// proposito: ver el comentario de arriba sobre mantener el modulo puro.
//
// El decode va protegido: decodeURIComponent('%') lanza URIError, y esta
// funcion corre en CADA request desde el middleware global. Sin el try/catch,
// una cookie os_auth malformada (cualquier subdominio de franciscoabad.com
// puede setear una cookie de host) tumbaria toda ruta protegida con un 500 en
// vez de mandar a /login. Ante valor invalido devolvemos undefined: se falla
// cerrado, igual que si la cookie no existiera.
export function leerCookie(request: Request, nombre: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const parte of header.split(';')) {
    const idx = parte.indexOf('=');
    if (idx < 0) continue;
    if (parte.slice(0, idx).trim() !== nombre) continue;
    const crudo = parte.slice(idx + 1).trim();
    try {
      return decodeURIComponent(crudo);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Sesion de navegador: solo cookie. Es el criterio que usa el middleware
// global para decidir si renderiza la pagina o manda a /login, identico al
// `src/middleware.ts` de Astro.
export function tieneSesionOs(request: Request): boolean {
  const cookieToken = leerCookie(request, OS_AUTH_COOKIE);
  const sessionToken = readEnv('OS_AUTH_TOKEN');
  return Boolean(cookieToken && sessionToken && cookieToken === sessionToken);
}

// Los dos tokens que puede traer una request de agente/dispositivo. Se
// devuelven crudos: quien los use decide si los compara contra el .env o
// contra el hash de os_devices.
function tokensDeCabecera(request: Request): string[] {
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const externalToken = request.headers.get('x-os-token');
  return [bearer, externalToken].filter((t): t is string => Boolean(t));
}

// Autorizacion SIN base de datos: cookie de sesion O token de API del .env
// (Bearer / X-OS-Token), que es como entran Hermes, n8n, el MCP y las keys con
// nombre de OS_API_TOKENS.
//
// Se exporta aparte de isOsAuthorized() porque es sincrona y por lo tanto usable
// desde el middleware global, que corre en cada request y no puede pagar un
// viaje a Supabase.
export function isOsAuthorizedSync(request: Request): boolean {
  if (tieneSesionOs(request)) return true;

  const sessionToken = readEnv('OS_AUTH_TOKEN');
  const apiToken = readEnv('OS_API_TOKEN') ?? sessionToken;
  const lista = readEnv('OS_API_TOKENS');

  return tokensDeCabecera(request).some((t) => esTokenValido(t, apiToken, lista));
}

// --- Tercer camino: tokens de dispositivo emparejado -------------------------
//
// Por que un seam inyectable y no un import directo de devices.handlers.ts:
// este modulo esta en el grafo de src/start.ts, que SI se bundlea para el
// cliente (ver la cabecera del archivo). Un import estatico de Supabase y de
// node:crypto ahi seria arrastrarlos al navegador. El import dinamico queda
// como chunk aparte que el cliente nunca pide, y ademas le da a los tests una
// forma de inyectar un doble sin tocar Supabase.

export type VerificadorDispositivo = (token: string) => Promise<boolean>;

const verificadorPorDefecto: VerificadorDispositivo = async (token) => {
  const { verificarTokenDispositivo, tocarUltimoUso } = await import('./devices.handlers.ts');
  const deviceId = await verificarTokenDispositivo(token);
  if (!deviceId) return false;
  // Best-effort de verdad: sin await y sin poder rechazar. La autorizacion ya
  // esta concedida, un fallo escribiendo last_seen_at no puede revertirla.
  void tocarUltimoUso(deviceId);
  return true;
};

let verificadorActual: VerificadorDispositivo = verificadorPorDefecto;

/** Solo para tests: inyecta un doble del lookup de os_devices. */
export function setVerificadorDispositivo(fn: VerificadorDispositivo | null): void {
  verificadorActual = fn ?? verificadorPorDefecto;
}

// Falla en silencio hacia "no autorizado por este camino". Si la migracion
// 20260823000000 todavia no se aplico, Supabase responde 42P01 (relation does
// not exist) y eso NO puede romper la cookie ni OS_API_TOKENS, que siguen
// atendiendo igual.
async function autorizadoPorDispositivo(request: Request): Promise<boolean> {
  for (const token of tokensDeCabecera(request)) {
    try {
      if (await verificadorActual(token)) return true;
    } catch {
      // `continue`, no `return false`: una request puede traer Authorization y
      // X-OS-Token a la vez, y que el primero explote no puede dejar sin
      // evaluar al segundo. Hoy verificarTokenDispositivo se traga todo
      // internamente y esto no se ejecuta nunca; el dia que propague algo, la
      // version con `return` seria un rechazo silencioso de un token valido.
      continue;
    }
  }
  return false;
}

// Autorizacion completa: cookie de sesion, token del .env, o token de un
// dispositivo emparejado (os_devices, hash sha256, revocable desde /sistema).
//
// Es async desde el pairing de Fase 2.1: el tercer camino consulta Supabase.
// Todos los llamadores tienen que hacer `await`; un `if (!isOsAuthorized(req))`
// sin await evalua una Promise (siempre truthy) y abriria el endpoint entero.
export async function isOsAuthorized(request: Request): Promise<boolean> {
  if (isOsAuthorizedSync(request)) return true;
  return autorizadoPorDispositivo(request);
}

// --- Defensa CSRF de los server routes de os-auth ---------------------------
//
// El CSRF middleware de src/start.ts filtra por `handlerType === 'serverFn'`,
// asi que NO cubre nada de /api/**. Para la mayoria de los endpoints eso da
// igual (los llaman agentes con Bearer), pero /api/os-auth/pair/confirm acuña
// una credencial y /api/os-auth/devices/$id revoca una, y las dos aceptan la
// cookie os_auth como autenticacion.
//
// SameSite=Lax frena el caso cross-site clasico, pero "same site" incluye a
// cualquier subdominio de franciscoabad.com: un origen hermano comprometido
// puede hacer que el navegador de Pancho POSTee /pair/confirm con un codigo que
// el atacante creo (pair/start es publico) y despues reclamar el token con su
// propio device_id. La respuesta se la come CORS, pero el efecto de lado ya
// ocurrio. Ver tambien el comentario de leerCookie sobre subdominios.
//
// Regla, en orden:
//   1. Sec-Fetch-Site, que mandan todos los navegadores actuales y ningun
//      cliente puede falsificar desde JS. Solo pasan 'same-origin' y 'none'
//      (barra de direcciones). 'same-site' se rechaza: ese es justamente el
//      subdominio hermano.
//   2. Sin Sec-Fetch-Site pero con Origin: se compara el host. El host y no el
//      origen completo porque detras de Caddy el esquema que reconstruye Nitro
//      puede ser http mientras el Origin del navegador dice https, y eso daria
//      un falso negativo que rompe la UI. Para CSRF lo que importa es el host:
//      el atacante siempre esta en otro.
//   3. Ni uno ni otro: se permite. Es una request que no viene de un navegador
//      (curl, Hermes, el MCP, un agente), y a esas CSRF no les aplica: nadie
//      puede hacer que manden cabeceras con la cookie de la victima.
export function origenPermitido(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';

  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// Identidad aproximada del cliente, para el limite de frecuencia de pair/start.
//
// En produccion la request llega desde Caddy, que APENDA su peer al final de
// X-Forwarded-For. Por eso se toma la ULTIMA entrada y no la primera: la
// primera la controla el cliente (puede mandar su propio X-Forwarded-For y
// Caddy lo conserva), la ultima es la IP que Caddy vio de verdad. Con un solo
// proxy delante, esa es la unica confiable.
//
// Sin cabeceras de proxy (dev, o un curl directo al 4322) todos los clientes
// comparten la clave 'desconocido' y por lo tanto el mismo cupo. Es
// conservador a proposito: preferimos apretar de mas en un entorno sin proxy
// que dar cupo infinito a quien simplemente no manda la cabecera.
export function claveClienteRequest(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const partes = xff.split(',').map((p) => p.trim()).filter(Boolean);
    const ultima = partes[partes.length - 1];
    if (ultima) return ultima;
  }
  return request.headers.get('x-real-ip')?.trim() || 'desconocido';
}

// Serializamos el Set-Cookie a mano en vez de usar setCookie() del framework:
// los handlers de os-auth devuelven su propio Response (un 302), y armar la
// cabecera ahi mismo es determinista, sin depender de como se mezclan las
// cabeceras ambiente con el Response devuelto.
export function cookieSesionOs(token: string): string {
  return [
    `${OS_AUTH_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${OS_AUTH_COOKIE_MAX_AGE}`,
  ].join('; ');
}

export function cookieSesionOsBorrada(): string {
  return [
    `${OS_AUTH_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
