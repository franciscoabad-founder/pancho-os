// Pruebas de la logica pura de taski.handlers.ts y del rotulado compartido de
// sesiones (src/os/lib/sesiones.ts). Sin red: aca solo se prueban las funciones
// que traducen lo que devuelve Hermes a lo que necesita la UI.
//
// Cubre los tres errores que motivaron el fix del 6 sep 2026:
//   - el catalogo de modelos venia de /v1/models y solo traia "hermes-agent"
//   - last_active llegaba en segundos y se pintaba como 1970
//   - las sesiones os-chat-* nunca aparecian porque se filtraba source=telegram

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aMilisegundos,
  aplanarOpcionesModelo,
  clasificarOrigen,
  listarPerfilesHermes,
  listarSesionesTaski,
  partirModelo,
  resolverDestino,
  validarOrigen,
} from './taski.handlers.ts';
import { etiquetaSesion, fechaSesion, nombreSesion } from '../os/lib/sesiones.ts';
import { validarPerfilHermes } from '../os/lib/perfilesHermes.ts';

test('aplanarOpcionesModelo arma la lista real de proveedor/modelo', () => {
  const modelos = aplanarOpcionesModelo({
    providers: [
      { slug: 'deepseek', name: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-r2'] },
      { slug: 'openai', name: 'OpenAI', models: ['gpt-4o'] },
    ],
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  });

  assert.deepEqual(
    modelos.map((m) => m.id),
    ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-r2', 'openai/gpt-4o'],
  );
  // El que el gateway reporta como configurado queda marcado.
  assert.equal(modelos[0].isCurrent, true);
  assert.equal(modelos[1].isCurrent, false);
  assert.equal(modelos[2].provider, 'openai');
  assert.equal(modelos[2].modelId, 'gpt-4o');
});

test('aplanarOpcionesModelo descarta el modelo virtual y los duplicados', () => {
  const modelos = aplanarOpcionesModelo({
    providers: [
      { slug: 'x', name: 'X', models: ['hermes-agent', 'uno', 'uno'] },
      { slug: 'x', name: 'X', models: ['uno'] },
    ],
  });
  // "hermes-agent" no es un modelo real: es el alias que /v1/models anuncia
  // para "usa el default del gateway", y Hermes mismo lo anula si se lo mandan.
  assert.deepEqual(modelos.map((m) => m.id), ['x/uno']);
});

test('aplanarOpcionesModelo avisa cuando el proveedor no esta autenticado', () => {
  const [modelo] = aplanarOpcionesModelo({
    providers: [{ slug: 'anthropic', name: 'Anthropic', models: ['claude'], authenticated: false, warning: 'Sin API key' }],
  });
  assert.equal(modelo.description, 'Sin API key');
});

test('aplanarOpcionesModelo tolera un payload vacio o mal formado', () => {
  assert.deepEqual(aplanarOpcionesModelo({}), []);
  assert.deepEqual(aplanarOpcionesModelo({ providers: 'nada' }), []);
  assert.deepEqual(aplanarOpcionesModelo({ providers: [{ name: 'sin slug', models: ['a'] }] }), []);
});

test('partirModelo separa proveedor y modelo por la primera barra', () => {
  assert.deepEqual(partirModelo('openai/gpt-4o'), { provider: 'openai', model: 'gpt-4o' });
  // Aggregadores: el modelo puede traer barras propias y hay que conservarlas.
  assert.deepEqual(partirModelo('openrouter/deepseek/deepseek-v4'), {
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4',
  });
  assert.deepEqual(partirModelo('gpt-4o'), { model: 'gpt-4o' });
});

test('aMilisegundos normaliza el epoch en segundos de Hermes', () => {
  // 6 sep 2026 en segundos.
  assert.equal(aMilisegundos(1788700000), 1788700000000);
  // Ya en milisegundos: se respeta.
  assert.equal(aMilisegundos(1788700000000), 1788700000000);
  assert.equal(aMilisegundos('1788700000'), 1788700000000);
  assert.equal(aMilisegundos(null), null);
  assert.equal(aMilisegundos(0), null);
  assert.equal(aMilisegundos('hola'), null);
});

test('clasificarOrigen separa Telegram, OS y ruido interno', () => {
  assert.equal(clasificarOrigen('telegram', 'agent:main:telegram:forum:-100:53'), 'telegram');
  assert.equal(clasificarOrigen('api_server', 'os-chat-ab12cd34'), 'os');
  assert.equal(clasificarOrigen('api_server', 'pancho-os'), 'os');
  // Una sesion del OS aunque el source venga raro.
  assert.equal(clasificarOrigen('desconocido', 'os-chat-ab12cd34'), 'os');
  // Ejecuciones internas de Hermes: no son conversaciones de Pancho.
  assert.equal(clasificarOrigen('cron', 'cron-1'), null);
  assert.equal(clasificarOrigen('a2a', 'a2a-1'), null);
  assert.equal(clasificarOrigen('cli', 'cli-1'), null);
});

test('validarOrigen cae a "todas" ante cualquier basura', () => {
  assert.equal(validarOrigen('telegram'), 'telegram');
  assert.equal(validarOrigen('os'), 'os');
  assert.equal(validarOrigen('todas'), 'todas');
  assert.equal(validarOrigen(undefined), 'todas');
  assert.equal(validarOrigen('; drop table'), 'todas');
});

test('etiquetaSesion muestra Nombre y dd/mm HH:mm, sin el conteo pegado', () => {
  const ms = new Date(2026, 8, 6, 14, 5).getTime(); // 06/09 14:05 local
  const etiqueta = etiquetaSesion({ id: 'x', title: 'Friendly greeting', messageCount: 83, lastActive: ms });
  assert.equal(etiqueta, 'Friendly greeting · 06/09 14:05');
  // El conteo NO va en el nombre: son mensajes acumulados, no sin leer.
  assert.ok(!etiqueta.includes('83'));
});

test('etiquetaSesion sin fecha no deja un separador huerfano', () => {
  assert.equal(etiquetaSesion({ id: 'x', title: 'Taski OS', lastActive: null }), 'Taski OS');
});

test('fechaSesion tolera epoch en segundos', () => {
  const ms = new Date(2026, 0, 2, 9, 7).getTime();
  assert.equal(fechaSesion(ms), '02/01 09:07');
  assert.equal(fechaSesion(Math.floor(ms / 1000)), '02/01 09:07');
  assert.equal(fechaSesion(null), '');
  assert.equal(fechaSesion(undefined), '');
});

test('nombreSesion inventa un rotulo util cuando Hermes no dio titulo', () => {
  assert.equal(nombreSesion({ id: 'pancho-os', title: null }), 'Taski (OS)');
  assert.equal(nombreSesion({ id: 'zzz', title: null, origen: 'telegram' }), 'Conversacion de Telegram');
  assert.equal(nombreSesion({ id: 'os-chat-ab12cd34', title: null }), 'Conversacion del OS');
  assert.equal(nombreSesion({ id: 'algo-muy-largo-de-verdad', title: '   ' }), 'algo-muy-lar');
});

// --- Perfiles reales de Hermes (F2) ----------------------------------------
//
// Nodo (donde corre) y perfil (que agente atiende) son ejes distintos.
// resolverDestino es el unico lugar que sabe traducirlos a base + token, y
// tiene que devolver undefined (no lanzar) cuando a un perfil le faltan sus
// variables: el VPS todavia esta habilitando los api_server por perfil.

const VARIABLES_PERFILES = [
  'TASKI_BASE_URL', 'TASKI_TOKEN', 'TASKI_BASE_HOMELAB', 'TASKI_BASE_LAPTOP',
  'TASKI_BASE_ARAZZA', 'TASKI_TOKEN_ARAZZA', 'TASKI_BASE_NERIO', 'TASKI_TOKEN_NERIO',
  'TASKI_BASE_RAFIK', 'TASKI_TOKEN_RAFIK', 'TASKI_BASE_TASKR', 'TASKI_TOKEN_TASKR',
];

/** Corre `fn` con las variables de Hermes en un estado conocido. */
async function conEntorno(valores: Record<string, string>, fn: () => Promise<void> | void): Promise<void> {
  const previo = new Map(VARIABLES_PERFILES.map((k) => [k, process.env[k]]));
  for (const k of VARIABLES_PERFILES) delete process.env[k];
  Object.assign(process.env, valores);
  try {
    await fn();
  } finally {
    for (const [k, v] of previo) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('resolverDestino: el perfil default sale del nodo, como antes de F2', async () => {
  await conEntorno({ TASKI_TOKEN: 'tok-vps' }, () => {
    // Sin TASKI_BASE_URL se usa la base canonica de Caddy.
    assert.deepEqual(resolverDestino('default'), {
      base: 'https://brain.franciscoabad.com/taski',
      token: 'tok-vps',
    });
    // Un nodo sin base configurada no tiene a donde preguntar.
    assert.equal(resolverDestino('default', 'homelab-local'), undefined);
  });
});

test('resolverDestino: un perfil sin sus variables queda no configurado, no revienta', async () => {
  await conEntorno({ TASKI_TOKEN: 'tok-vps' }, () => {
    assert.equal(resolverDestino('arazza'), undefined);
    assert.equal(resolverDestino('nerio'), undefined);
    assert.equal(resolverDestino('rafik'), undefined);
    assert.equal(resolverDestino('taskr'), undefined);
  });
});

test('resolverDestino: un perfil configurado usa su base y su token propios', async () => {
  await conEntorno(
    {
      TASKI_TOKEN: 'tok-vps',
      TASKI_BASE_RAFIK: 'https://brain.franciscoabad.com/taski-rafik',
      TASKI_TOKEN_RAFIK: 'tok-rafik',
      // Arazza sin token propio: se cae al TASKI_TOKEN historico.
      TASKI_BASE_ARAZZA: 'https://brain.franciscoabad.com/taski-arazza',
    },
    () => {
      assert.deepEqual(resolverDestino('rafik'), {
        base: 'https://brain.franciscoabad.com/taski-rafik',
        token: 'tok-rafik',
      });
      assert.deepEqual(resolverDestino('arazza'), {
        base: 'https://brain.franciscoabad.com/taski-arazza',
        token: 'tok-vps',
      });
      // El nodo no altera el destino de un perfil que no es el default.
      assert.deepEqual(resolverDestino('rafik', 'laptop-local'), resolverDestino('rafik'));
    },
  );
});

test('listarPerfilesHermes devuelve los 5 agentes y explica los que faltan', async () => {
  const fetchOriginal = globalThis.fetch;
  // Health check doblado: aca no se prueba la red, se prueba el reporte.
  globalThis.fetch = (async () => new Response('{}', { status: 500 })) as typeof globalThis.fetch;
  try {
    await conEntorno({ TASKI_TOKEN: 'tok-vps' }, async () => {
      const perfiles = await listarPerfilesHermes();
      assert.deepEqual(perfiles.map((p) => p.id), ['default', 'arazza', 'nerio', 'rafik', 'taskr']);
      assert.deepEqual(perfiles.map((p) => p.etiqueta), ['Alfred', 'Arazza', 'Nerio', 'Rafik', 'Taskr']);

      // Alfred siempre tiene base (la canonica), asi que esta configurado; el
      // health doblado responde 500, asi que sale offline con motivo.
      assert.equal(perfiles[0].configurado, true);
      assert.equal(perfiles[0].online, false);
      assert.match(String(perfiles[0].motivo), /health check/);

      // Los otros cuatro sin variables: no configurados, y el motivo dice
      // exactamente que falta en el .env.
      for (const p of perfiles.slice(1)) {
        assert.equal(p.configurado, false);
        assert.equal(p.online, false);
        assert.match(String(p.motivo), new RegExp(`TASKI_BASE_${p.id.toUpperCase()}`));
      }
    });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('validarPerfilHermes cae a default ante cualquier basura', () => {
  assert.equal(validarPerfilHermes('rafik'), 'rafik');
  assert.equal(validarPerfilHermes('taskr'), 'taskr');
  assert.equal(validarPerfilHermes(undefined), 'default');
  assert.equal(validarPerfilHermes('vps-default'), 'default');
  assert.equal(validarPerfilHermes('; drop table'), 'default');
});


// F3: el OS necesita las coordenadas del topic para poder engancharle un tema.
// Antes el mapeo las tiraba y no habia forma de saber a que topic pertenecia
// una sesion de Telegram.
test('listarSesionesTaski expone chat_id, thread_id y session_key del topic', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const ruta = String(url instanceof Request ? url.url : url);
    // La sesion legacy del OS se pide aparte; aca no interesa.
    if (ruta.includes('/api/sessions/pancho-os')) return new Response('{}', { status: 404 });
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'tg-51',
            source: 'telegram',
            title: 'Pancho HQ / Ideas',
            last_active: 1_757_000_000,
            chat_id: -1004384794270,
            thread_id: 51,
            session_key: 'agent:main:telegram:forum:-1004384794270:51',
          },
          // Sesion del OS: no tiene coordenadas y no debe inventarlas.
          { id: 'os-chat-abc', source: 'api_server', title: 'Tema del OS' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof globalThis.fetch;

  try {
    await conEntorno({ TASKI_TOKEN: 'tok-vps' }, async () => {
      const sesiones = await listarSesionesTaski('vps-default', 'todas');
      const tg = sesiones.find((s) => s.id === 'tg-51');
      assert.ok(tg);
      assert.equal(tg.origen, 'telegram');
      // chat_id viaja como string: los ids de grupo son enteros muy grandes.
      assert.equal(tg.chatId, '-1004384794270');
      assert.equal(tg.threadId, 51);
      assert.equal(tg.sessionKey, 'agent:main:telegram:forum:-1004384794270:51');

      const os = sesiones.find((s) => s.id === 'os-chat-abc');
      assert.ok(os);
      assert.equal(os.chatId, null);
      assert.equal(os.threadId, null);
      assert.equal(os.sessionKey, null);
    });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('aplanarOpcionesModelo muestra solo las membresias autenticadas cuando hay alguna', () => {
  const modelos = aplanarOpcionesModelo({
    providers: [
      { slug: 'nous', name: 'Nous Portal', models: [], authenticated: false, warning: 'sin login' },
      { slug: 'xai-oauth', name: 'xAI', models: ['grok-4.3'], authenticated: true },
      { slug: 'anthropic', name: 'Anthropic', models: ['claude'], authenticated: false },
    ],
    model: 'grok-4.3',
    provider: 'xai-oauth',
  });
  assert.deepEqual(modelos.map((m) => m.id), ['xai-oauth/grok-4.3']);
  assert.equal(modelos[0].isCurrent, true);
});
