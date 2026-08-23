// Test de contrato del middleware global (paso 1.2.2 del plan). Ejercita la
// misma funcion que corre osAuthMiddleware.ts en cada request, sin framework:
// que rutas pasan sin sesion, que devuelve cuando falta la sesion, y que los
// bypasses de dev no aplican en produccion.

import assert from 'node:assert/strict';
import test from 'node:test';
import { decidirAccesoOs, esRutaPublica } from './osAuthPolicy.ts';

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://os.franciscoabad.com/', { headers });
}

function conToken(token: string | undefined, fn: () => void) {
  const previo = process.env.OS_AUTH_TOKEN;
  if (token === undefined) delete process.env.OS_AUTH_TOKEN;
  else process.env.OS_AUTH_TOKEN = token;
  try {
    fn();
  } finally {
    if (previo === undefined) delete process.env.OS_AUTH_TOKEN;
    else process.env.OS_AUTH_TOKEN = previo;
  }
}

// --- esRutaPublica ---------------------------------------------------------

test('son publicas exactamente las rutas que lo eran en Astro', () => {
  for (const p of [
    '/login',
    '/sw.js',
    '/manifest.webmanifest',
    '/os-offline.html',
    '/favicon.ico',
    '/favicon.svg',
    '/os-icon-192.png',
    '/api/mcp',
    '/api/tareas',
  ]) {
    assert.equal(esRutaPublica(p), true, `deberia ser publica: ${p}`);
  }
});

test('las paginas del OS no son publicas', () => {
  for (const p of ['/', '/hoy', '/tareas', '/salud', '/finanzas', '/gfit/reproductor']) {
    assert.equal(esRutaPublica(p), false, `no deberia ser publica: ${p}`);
  }
});

test('la pantalla de emparejamiento del dispositivo nuevo es publica', () => {
  // El que la abre todavia no tiene credencial: si el middleware la mandara a
  // /login, el pairing por QR no podria completarse nunca.
  assert.equal(esRutaPublica('/pair/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'), true);
});

test('la lista publica no se abre por prefijo accidental', () => {
  // '/login' es exacto, no prefijo: '/logins-secretos' no debe colarse.
  assert.equal(esRutaPublica('/loginsecreto'), false);
  assert.equal(esRutaPublica('/login/extra'), false);
  // '/api/' lleva barra: '/apix' no es la API.
  assert.equal(esRutaPublica('/apix'), false);
  assert.equal(esRutaPublica('/api'), false);
  // '/pair/' idem: la barra es lo que impide que '/pairing-secreto' se cuele.
  assert.equal(esRutaPublica('/pairx'), false);
  assert.equal(esRutaPublica('/pair'), false);
});

test('las server functions NO son publicas', () => {
  // TSS_SERVER_FN_BASE es '/_serverFn/', que no cae bajo ningun prefijo
  // publico: sin sesion tienen que cortar con 401.
  assert.equal(esRutaPublica('/_serverFn/src_utils_tareas_ts--listar'), false);
});

test('los bypasses del dev server NO son publicos en la politica', () => {
  // La politica describe produccion y nada mas. El bypass de dev vive en
  // osAuthMiddleware.ts dentro de `if (import.meta.env.DEV)`, que el build
  // elimina; si alguien lo moviera aca, estos casos lo cazan.
  for (const p of [
    '/@vite/client',
    '/@fs/C:/DEV/Pancho-OS/src/routes/index.tsx',
    '/src/routes/index.tsx',
    '/node_modules/.vite/deps/react.js',
    '/qa-tareas',
  ]) {
    assert.equal(esRutaPublica(p), false, `fuga de dev: ${p}`);
  }
});

test('sin sesion, un path de dev tampoco pasa por decidirAccesoOs', () => {
  conToken('tok-sesion', () => {
    const r = decidirAccesoOs({ pathname: '/qa-tareas', request: req(), handlerType: 'router' });
    assert.ok(r, 'debio cortar');
    assert.equal(r.status, 302);
  });
});

// --- decidirAccesoOs -------------------------------------------------------

test('una ruta publica pasa sin mirar la sesion', () => {
  conToken(undefined, () => {
    assert.equal(decidirAccesoOs({ pathname: '/login', request: req() }), undefined);
    assert.equal(decidirAccesoOs({ pathname: '/api/mcp', request: req() }), undefined);
  });
});

test('sin sesion, una pagina redirige 302 a /login', () => {
  conToken('tok-sesion', () => {
    const r = decidirAccesoOs({ pathname: '/hoy', request: req(), handlerType: 'router' });
    assert.ok(r, 'debio cortar');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/login');
  });
});

test('sin sesion, una server function corta con 401 (no con HTML)', () => {
  conToken('tok-sesion', () => {
    const r = decidirAccesoOs({ pathname: '/_serverFn/x', request: req(), handlerType: 'serverFn' });
    assert.ok(r, 'debio cortar');
    assert.equal(r.status, 401);
  });
});

test('con sesion valida pasa cualquier pagina', () => {
  conToken('tok-sesion', () => {
    const r = req({ cookie: 'os_auth=tok-sesion' });
    assert.equal(decidirAccesoOs({ pathname: '/hoy', request: r, handlerType: 'router' }), undefined);
    assert.equal(decidirAccesoOs({ pathname: '/_serverFn/x', request: r, handlerType: 'serverFn' }), undefined);
  });
});

test('sin OS_AUTH_TOKEN configurado, nada protegido pasa', () => {
  conToken(undefined, () => {
    const r = decidirAccesoOs({
      pathname: '/hoy',
      request: req({ cookie: 'os_auth=lo-que-sea' }),
      handlerType: 'router',
    });
    assert.ok(r, 'debio cortar: fallar cerrado');
    assert.equal(r.status, 302);
  });
});

test('una cookie os_auth malformada redirige a /login, no rompe con 500', () => {
  // Regresion contra el parser de cookies hecho a mano: decodeURIComponent('%')
  // lanza URIError y aca eso significaria 500 en toda ruta protegida.
  conToken('tok-sesion', () => {
    let r: Response | undefined;
    assert.doesNotThrow(() => {
      r = decidirAccesoOs({
        pathname: '/hoy',
        request: req({ cookie: 'os_auth=%' }),
        handlerType: 'router',
      });
    });
    assert.ok(r, 'debio cortar');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/login');
  });
});
