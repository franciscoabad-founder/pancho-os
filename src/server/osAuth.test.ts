// Contrato del bridge de auth portado a TanStack Start. Cubre las tres cosas
// que el port podia romper respecto de Astro:
//   1. el parseo de la cookie a mano (Astro usaba el parser del framework),
//   2. el fallo cerrado cuando faltan las env vars,
//   3. los atributos del Set-Cookie de login y de logout.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OS_AUTH_COOKIE,
  cookieSesionOs,
  cookieSesionOsBorrada,
  isOsAuthorized,
  leerCookie,
  tieneSesionOs,
} from './osAuth.ts';

const ENV_AUTH = ['OS_AUTH_TOKEN', 'OS_API_TOKEN', 'OS_API_TOKENS'] as const;

function conEnv(valores: Partial<Record<(typeof ENV_AUTH)[number], string>>, fn: () => void) {
  const previo = ENV_AUTH.map((k) => [k, process.env[k]] as const);
  for (const k of ENV_AUTH) delete process.env[k];
  for (const [k, v] of Object.entries(valores)) process.env[k] = v;
  try {
    fn();
  } finally {
    for (const [k, v] of previo) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://os.franciscoabad.com/hoy', { headers });
}

// --- leerCookie ------------------------------------------------------------

test('leerCookie devuelve undefined sin header Cookie', () => {
  assert.equal(leerCookie(req(), OS_AUTH_COOKIE), undefined);
});

test('leerCookie encuentra la cookie entre varias', () => {
  const r = req({ cookie: 'theme=dark; os_auth=tok-123; otra=1' });
  assert.equal(leerCookie(r, OS_AUTH_COOKIE), 'tok-123');
});

test('leerCookie no confunde una cookie cuyo nombre contiene al buscado', () => {
  const r = req({ cookie: 'no_os_auth=intruso; os_auth_extra=otro' });
  assert.equal(leerCookie(r, OS_AUTH_COOKIE), undefined);
});

test('leerCookie decodifica el valor percent-encoded', () => {
  const r = req({ cookie: `os_auth=${encodeURIComponent('tok con espacio/y+simbolos')}` });
  assert.equal(leerCookie(r, OS_AUTH_COOKIE), 'tok con espacio/y+simbolos');
});

test('leerCookie NO lanza con un valor mal codificado', () => {
  // decodeURIComponent('%') tira URIError. Esto corre en cada request desde el
  // middleware global: si escapara, toda ruta protegida devolveria 500 en vez
  // de redirigir a /login.
  for (const malo of ['%', '%zz', '%E0%A4%A']) {
    const r = req({ cookie: `os_auth=${malo}` });
    assert.doesNotThrow(() => leerCookie(r, OS_AUTH_COOKIE));
    assert.equal(leerCookie(r, OS_AUTH_COOKIE), undefined, `valor malo: ${malo}`);
  }
});

// --- tieneSesionOs ---------------------------------------------------------

test('tieneSesionOs falla cerrado si OS_AUTH_TOKEN no esta configurado', () => {
  conEnv({}, () => {
    assert.equal(tieneSesionOs(req({ cookie: 'os_auth=lo-que-sea' })), false);
  });
});

test('tieneSesionOs es true solo con cookie identica al token de sesion', () => {
  conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => {
    assert.equal(tieneSesionOs(req({ cookie: 'os_auth=tok-sesion' })), true);
    assert.equal(tieneSesionOs(req({ cookie: 'os_auth=otro' })), false);
    assert.equal(tieneSesionOs(req()), false);
  });
});

test('tieneSesionOs ignora los headers de API (es solo sesion de navegador)', () => {
  conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => {
    assert.equal(tieneSesionOs(req({ authorization: 'Bearer tok-sesion' })), false);
    assert.equal(tieneSesionOs(req({ 'x-os-token': 'tok-sesion' })), false);
  });
});

test('la cookie que emite el login abre sesion al volver como header', () => {
  // Ida y vuelta completa: lo que serializa cookieSesionOs tiene que ser
  // exactamente lo que leerCookie/tieneSesionOs aceptan despues.
  const token = 'tok con espacio';
  const valor = cookieSesionOs(token).split(';')[0]!;
  conEnv({ OS_AUTH_TOKEN: token }, () => {
    assert.equal(tieneSesionOs(req({ cookie: valor })), true);
  });
});

// --- isOsAuthorized --------------------------------------------------------

test('isOsAuthorized falla cerrado sin ninguna env var', () => {
  conEnv({}, () => {
    assert.equal(isOsAuthorized(req()), false);
    assert.equal(isOsAuthorized(req({ cookie: 'os_auth=x' })), false);
    assert.equal(isOsAuthorized(req({ authorization: 'Bearer x' })), false);
    assert.equal(isOsAuthorized(req({ 'x-os-token': 'x' })), false);
  });
});

test('isOsAuthorized acepta la sesion de navegador', () => {
  conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => {
    assert.equal(isOsAuthorized(req({ cookie: 'os_auth=tok-sesion' })), true);
  });
});

test('isOsAuthorized acepta Bearer y X-OS-Token con el token maestro', () => {
  conEnv({ OS_API_TOKEN: 'tok-api' }, () => {
    assert.equal(isOsAuthorized(req({ authorization: 'Bearer tok-api' })), true);
    assert.equal(isOsAuthorized(req({ authorization: 'bearer tok-api' })), true);
    assert.equal(isOsAuthorized(req({ 'x-os-token': 'tok-api' })), true);
    assert.equal(isOsAuthorized(req({ authorization: 'Bearer otro' })), false);
  });
});

test('isOsAuthorized cae a OS_AUTH_TOKEN como token de API si no hay OS_API_TOKEN', () => {
  // Comportamiento heredado de Astro (`OS_API_TOKEN ?? sessionToken`): Hermes
  // y el MCP funcionaban con una sola env var configurada.
  conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => {
    assert.equal(isOsAuthorized(req({ authorization: 'Bearer tok-sesion' })), true);
  });
});

test('isOsAuthorized acepta una key con nombre de OS_API_TOKENS', () => {
  conEnv({ OS_API_TOKEN: 'tok-api', OS_API_TOKENS: 'kimi:abc123,grok:xyz789' }, () => {
    assert.equal(isOsAuthorized(req({ 'x-os-token': 'abc123' })), true);
    assert.equal(isOsAuthorized(req({ authorization: 'Bearer xyz789' })), true);
    assert.equal(isOsAuthorized(req({ 'x-os-token': 'kimi' })), false);
    assert.equal(isOsAuthorized(req({ 'x-os-token': 'revocado' })), false);
  });
});

test('isOsAuthorized no lanza con cookie mal codificada y token de API valido', () => {
  conEnv({ OS_API_TOKEN: 'tok-api' }, () => {
    const r = req({ cookie: 'os_auth=%', 'x-os-token': 'tok-api' });
    assert.equal(isOsAuthorized(r), true);
  });
});

// --- Set-Cookie ------------------------------------------------------------

test('cookieSesionOs conserva los atributos de la version Astro', () => {
  const c = cookieSesionOs('tok-123');
  assert.match(c, /^os_auth=tok-123;/);
  assert.match(c, /(^|; )Path=\/(;|$)/);
  assert.match(c, /(^|; )HttpOnly(;|$)/);
  assert.match(c, /(^|; )Secure(;|$)/);
  assert.match(c, /(^|; )SameSite=Lax(;|$)/);
  assert.match(c, /(^|; )Max-Age=2592000(;|$)/); // 30 dias
});

test('cookieSesionOs codifica el token', () => {
  assert.match(cookieSesionOs('a b;c'), /^os_auth=a%20b%3Bc;/);
});

test('cookieSesionOsBorrada borra de verdad (Max-Age=0 y mismo Path)', () => {
  const c = cookieSesionOsBorrada();
  assert.match(c, /^os_auth=;/);
  assert.match(c, /(^|; )Path=\/(;|$)/);
  assert.match(c, /(^|; )Max-Age=0(;|$)/);
  assert.match(c, /(^|; )HttpOnly(;|$)/);
  assert.match(c, /(^|; )Secure(;|$)/);
  assert.match(c, /(^|; )SameSite=Lax(;|$)/);
});
