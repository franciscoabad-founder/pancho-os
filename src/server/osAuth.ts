// Bridge de autenticacion del OS, portado de src/os/lib/osAuth.ts (Astro) a
// TanStack Start.
//
// Diferencia clave con la version Astro: aca NO dependemos de APIContext ni de
// helpers de contexto ambiente del framework. Todo recibe un `Request`
// explicito, asi el modulo queda puro y se puede usar desde los tres lugares:
//
//   - middleware de request (recibe `request` en las opciones)
//   - server routes de src/routes/api/** (reciben `request` en el handler)
//   - server functions: `isOsAuthorized(getRequest())`, con `getRequest`
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

// Autorizacion completa: cookie de sesion O token de API (Bearer / X-OS-Token),
// que es como entran Hermes, n8n, el MCP y las keys con nombre de OS_API_TOKENS.
export function isOsAuthorized(request: Request): boolean {
  if (tieneSesionOs(request)) return true;

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const externalToken = request.headers.get('x-os-token');

  const sessionToken = readEnv('OS_AUTH_TOKEN');
  const apiToken = readEnv('OS_API_TOKEN') ?? sessionToken;
  const lista = readEnv('OS_API_TOKENS');

  return esTokenValido(bearer, apiToken, lista) || esTokenValido(externalToken, apiToken, lista);
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
