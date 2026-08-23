// Contrato del bridge de auth portado a TanStack Start. Cubre las tres cosas
// que el port podia romper respecto de Astro:
//   1. el parseo de la cookie a mano (Astro usaba el parser del framework),
//   2. el fallo cerrado cuando faltan las env vars,
//   3. los atributos del Set-Cookie de login y de logout.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OS_AUTH_COOKIE,
  claveClienteRequest,
  cookieSesionOs,
  cookieSesionOsBorrada,
  isOsAuthorized,
  isOsAuthorizedSync,
  leerCookie,
  origenPermitido,
  setVerificadorDispositivo,
  tieneSesionOs,
} from './osAuth.ts';

const ENV_AUTH = ['OS_AUTH_TOKEN', 'OS_API_TOKEN', 'OS_API_TOKENS'] as const;

// conEnv es async desde que isOsAuthorized lo es (el tercer camino de auth,
// os_devices, consulta Supabase). Los casos que no usan await siguen andando:
// `await fn()` sobre una funcion sincrona corre el cuerpo igual.
async function conEnv(
  valores: Partial<Record<(typeof ENV_AUTH)[number], string>>,
  fn: () => void | Promise<void>,
) {
  const previo = ENV_AUTH.map((k) => [k, process.env[k]] as const);
  for (const k of ENV_AUTH) delete process.env[k];
  for (const [k, v] of Object.entries(valores)) process.env[k] = v;
  try {
    await fn();
  } finally {
    for (const [k, v] of previo) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// Doble del lookup de os_devices. Sin esto, cada test de isOsAuthorized
// intentaria abrir un cliente de Supabase real. `tokensValidos` vacio = ningun
// dispositivo emparejado, que es el estado previo a aplicar la migracion.
function conDispositivos(tokensValidos: string[], fn: () => Promise<void>) {
  setVerificadorDispositivo(async (token) => tokensValidos.includes(token));
  return fn().finally(() => setVerificadorDispositivo(null));
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
//
// isOsAuthorized es async: cuando ni la cookie ni el .env matchean, hashea el
// token y lo busca en os_devices. Todos los casos van con await y con el
// verificador de dispositivos mockeado.

test('isOsAuthorized falla cerrado sin ninguna env var', async () => {
  await conEnv({}, () => conDispositivos([], async () => {
    assert.equal(await isOsAuthorized(req()), false);
    assert.equal(await isOsAuthorized(req({ cookie: 'os_auth=x' })), false);
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer x' })), false);
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'x' })), false);
  }));
});

test('isOsAuthorized acepta la sesion de navegador', async () => {
  await conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => conDispositivos([], async () => {
    assert.equal(await isOsAuthorized(req({ cookie: 'os_auth=tok-sesion' })), true);
  }));
});

test('isOsAuthorized acepta Bearer y X-OS-Token con el token maestro', async () => {
  await conEnv({ OS_API_TOKEN: 'tok-api' }, () => conDispositivos([], async () => {
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer tok-api' })), true);
    assert.equal(await isOsAuthorized(req({ authorization: 'bearer tok-api' })), true);
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'tok-api' })), true);
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer otro' })), false);
  }));
});

test('isOsAuthorized cae a OS_AUTH_TOKEN como token de API si no hay OS_API_TOKEN', async () => {
  // Comportamiento heredado de Astro (`OS_API_TOKEN ?? sessionToken`): Hermes
  // y el MCP funcionaban con una sola env var configurada.
  await conEnv({ OS_AUTH_TOKEN: 'tok-sesion' }, () => conDispositivos([], async () => {
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer tok-sesion' })), true);
  }));
});

test('isOsAuthorized acepta una key con nombre de OS_API_TOKENS', async () => {
  await conEnv({ OS_API_TOKEN: 'tok-api', OS_API_TOKENS: 'kimi:abc123,grok:xyz789' }, () => conDispositivos([], async () => {
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'abc123' })), true);
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer xyz789' })), true);
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'kimi' })), false);
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'revocado' })), false);
  }));
});

test('isOsAuthorized no lanza con cookie mal codificada y token de API valido', async () => {
  await conEnv({ OS_API_TOKEN: 'tok-api' }, () => conDispositivos([], async () => {
    const r = req({ cookie: 'os_auth=%', 'x-os-token': 'tok-api' });
    assert.equal(await isOsAuthorized(r), true);
  }));
});

// --- tercer camino: dispositivos emparejados -------------------------------

test('isOsAuthorized acepta el token de un dispositivo emparejado', async () => {
  await conEnv({ OS_API_TOKEN: 'tok-api' }, () => conDispositivos(['tok-dispositivo'], async () => {
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'tok-dispositivo' })), true);
    assert.equal(await isOsAuthorized(req({ authorization: 'Bearer tok-dispositivo' })), true);
    assert.equal(await isOsAuthorized(req({ 'x-os-token': 'otro-cualquiera' })), false);
  }));
});

test('el camino de dispositivos no se consulta si el .env ya autorizo', async () => {
  let consultas = 0;
  setVerificadorDispositivo(async () => { consultas++; return false; });
  try {
    await conEnv({ OS_API_TOKEN: 'tok-api' }, async () => {
      assert.equal(await isOsAuthorized(req({ 'x-os-token': 'tok-api' })), true);
      assert.equal(consultas, 0, 'no debe pegarle a Supabase con un token del .env');
    });
  } finally {
    setVerificadorDispositivo(null);
  }
});

test('un fallo del lookup de dispositivos NO tumba los otros dos caminos', async () => {
  // Es el escenario real de "la migracion todavia no se aplico": Supabase
  // responde 42P01. La cookie y OS_API_TOKENS tienen que seguir andando.
  setVerificadorDispositivo(async () => { throw new Error('relation "os_devices" does not exist'); });
  try {
    await conEnv({ OS_AUTH_TOKEN: 'tok-sesion', OS_API_TOKENS: 'kimi:abc123' }, async () => {
      assert.equal(await isOsAuthorized(req({ cookie: 'os_auth=tok-sesion' })), true);
      assert.equal(await isOsAuthorized(req({ 'x-os-token': 'abc123' })), true);
      // Y el token desconocido cae a "no autorizado", sin propagar la excepcion.
      assert.equal(await isOsAuthorized(req({ 'x-os-token': 'desconocido' })), false);
    });
  } finally {
    setVerificadorDispositivo(null);
  }
});

// --- isOsAuthorizedSync ----------------------------------------------------

test('isOsAuthorizedSync resuelve cookie y .env sin tocar la base', async () => {
  let consultas = 0;
  setVerificadorDispositivo(async () => { consultas++; return true; });
  try {
    await conEnv({ OS_AUTH_TOKEN: 'tok-sesion', OS_API_TOKENS: 'kimi:abc123' }, () => {
      assert.equal(isOsAuthorizedSync(req({ cookie: 'os_auth=tok-sesion' })), true);
      assert.equal(isOsAuthorizedSync(req({ 'x-os-token': 'abc123' })), true);
      // Un token de dispositivo valido NO lo autoriza: para eso hace falta await.
      assert.equal(isOsAuthorizedSync(req({ 'x-os-token': 'tok-dispositivo' })), false);
      assert.equal(consultas, 0);
    });
  } finally {
    setVerificadorDispositivo(null);
  }
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

// --- origenPermitido -------------------------------------------------------
//
// Es la defensa CSRF de /api/os-auth/pair/confirm y del DELETE de devices/$id:
// el CSRF middleware de src/start.ts solo filtra server functions, asi que no
// llega a los server routes. Lo que se protege es que un origen hermano
// (cualquier subdominio de franciscoabad.com, que puede setear cookies de host)
// no pueda hacer que el navegador de Pancho acuñe o revoque credenciales.

test('origenPermitido acepta la request que sale de la propia pantalla', () => {
  assert.equal(origenPermitido(req({ 'sec-fetch-site': 'same-origin' })), true);
});

test('origenPermitido acepta la navegacion escrita a mano (Sec-Fetch-Site: none)', () => {
  assert.equal(origenPermitido(req({ 'sec-fetch-site': 'none' })), true);
});

test('origenPermitido rechaza cross-site Y same-site', () => {
  // 'same-site' es el caso que SameSite=Lax no tapa: otro subdominio de
  // franciscoabad.com. Ese es justamente el atacante que nos preocupa.
  assert.equal(origenPermitido(req({ 'sec-fetch-site': 'same-site' })), false);
  assert.equal(origenPermitido(req({ 'sec-fetch-site': 'cross-site' })), false);
});

test('sin Sec-Fetch-Site, origenPermitido compara el host del Origin', () => {
  assert.equal(origenPermitido(req({ origin: 'https://os.franciscoabad.com' })), true);
  // El esquema no se compara: detras de Caddy la URL que reconstruye el server
  // puede decir http mientras el navegador manda https, y eso seria un falso
  // negativo que rompe la pantalla sin ganar nada.
  assert.equal(origenPermitido(req({ origin: 'http://os.franciscoabad.com' })), true);
  assert.equal(origenPermitido(req({ origin: 'https://otro.franciscoabad.com' })), false);
  assert.equal(origenPermitido(req({ origin: 'https://malicioso.com' })), false);
  assert.equal(origenPermitido(req({ origin: 'no-es-una-url' })), false);
});

test('sin ninguna de las dos cabeceras se permite: no es un navegador', () => {
  // curl, Hermes, el MCP, un agente con Bearer. A esos CSRF no les aplica:
  // nadie puede hacer que manden cabeceras con la cookie de la victima.
  assert.equal(origenPermitido(req()), true);
});

test('Sec-Fetch-Site manda sobre Origin', () => {
  // Un atacante controla el Origin que su pagina manda, pero no puede fabricar
  // Sec-Fetch-Site: lo pone el navegador. Si estan los dos, gana el confiable.
  assert.equal(
    origenPermitido(req({ 'sec-fetch-site': 'cross-site', origin: 'https://os.franciscoabad.com' })),
    false,
  );
});

// --- claveClienteRequest ---------------------------------------------------

test('claveClienteRequest toma la ULTIMA entrada de X-Forwarded-For', () => {
  // Caddy apenda su peer al final. La primera entrada la controla el cliente
  // (puede mandar su propio X-Forwarded-For), asi que usarla haria trivial
  // saltarse el limite de frecuencia rotando un header.
  assert.equal(claveClienteRequest(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(
    claveClienteRequest(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' })),
    '203.0.113.9',
  );
});

test('claveClienteRequest cae a X-Real-IP y despues a una clave compartida', () => {
  assert.equal(claveClienteRequest(req({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4');
  // Sin cabeceras de proxy todos comparten cupo. Es conservador a proposito:
  // mejor apretar de mas que dar cupo infinito a quien no manda la cabecera.
  assert.equal(claveClienteRequest(req()), 'desconocido');
  assert.equal(claveClienteRequest(req({ 'x-forwarded-for': '  ' })), 'desconocido');
});
