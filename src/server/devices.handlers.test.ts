// Contrato del endpoint de pairing (pair/confirm y pair/status) sin tocar
// Supabase real: se inyecta un doble en memoria via setClienteSupabaseDevices,
// mismo seam que usa osAuth.test.ts para el verificador de dispositivos.
//
// Foco: las reglas que el resto de la suite no cubre (deviceAuth.test.ts prueba
// la cripto pura, osAuth.test.ts prueba isOsAuthorized ya mockeando el
// verificador). En orden de importancia:
//
//   - un codigo vencido no se confirma, y el status ya entregado no vuelve a
//     dar el token;
//   - ante dos solicitudes vivas con el mismo codigo no se elige ninguna;
//   - pair/start, que es publico, tiene cupo por cliente y tope global;
//   - un token que se pierde en un reinicio no deja un dispositivo activo.

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ErrorDispositivos,
  MAX_PAIRINGS_VIVOS,
  TABLA_DEVICES,
  TABLA_PAIRING,
  confirmarPairing,
  consultarPairing,
  iniciarPairing,
  resetearPurga,
  revocarDispositivo,
  setClienteSupabaseDevices,
} from './devices.handlers.ts';
import {
  PAIRING_MAX_POR_CLIENTE,
  vaciarCustodia,
  vaciarLimitePairing,
} from './deviceAuth.ts';

type Fila = Record<string, unknown>;

// Los ids de las dos tablas son uuid y los handlers ahora validan el formato
// antes de consultar, asi que los fixtures tienen que usar uuids de verdad.
const uuid = () => randomUUID();
const [P1, P2, P3, P4] = [uuid(), uuid(), uuid(), uuid()];

// --- doble minimo del query builder de supabase-js --------------------------
//
// Cubre solo las operaciones que devices.handlers.ts realmente usa
// (select/insert/update/delete, eq/is/gt/lt, order/limit, single/maybeSingle)
// sobre tablas en memoria. No es un mock generico de Supabase: alcanza para
// probar las reglas de negocio del pairing sin una base real.
//
// Emula tambien el indice unico parcial de la migracion
// (os_pairing_requests_code_abierto_idx): sin eso, el reintento por 23505 de
// iniciarPairing no tendria como ejercitarse.
function crearClienteFake(estado: { pairing: Fila[]; devices: Fila[] }): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === TABLA_PAIRING) return estado.pairing;
    if (nombre === TABLA_DEVICES) return estado.devices;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function builder(nombre: string) {
    let modo: 'select' | 'insert' | 'update' | 'delete' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila[] = [];
    let updateValues: Fila = {};
    let orden: { campo: string; asc: boolean } | null = null;
    let limite: number | null = null;
    let single = false;
    let maybeSingleFlag = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = tabla(nombre);

      if (modo === 'insert') {
        for (const r of insertRows) {
          if (
            nombre === TABLA_PAIRING &&
            filas.some((f) => f.code === r.code && (f.confirmed_at ?? null) === null)
          ) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
        }
        const nuevas = insertRows.map((r) => ({
          id: uuid(),
          created_at: new Date().toISOString(),
          ...r,
        }));
        filas.push(...nuevas);
        return { data: single ? nuevas[0] : nuevas, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        return { data: coincidencias, error: null };
      }

      if (modo === 'delete') {
        const borradas = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of borradas) filas.splice(filas.indexOf(f), 1);
        return { data: borradas, error: null };
      }

      // select
      let resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      if (orden) {
        const { campo, asc } = orden;
        resultado = [...resultado].sort((a, b) => {
          const av = String(a[campo] ?? '');
          const bv = String(b[campo] ?? '');
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limite != null) resultado = resultado.slice(0, limite);
      if (single) {
        return resultado[0]
          ? { data: resultado[0], error: null }
          : { data: null, error: { message: 'no rows returned', code: 'PGRST116' } };
      }
      if (maybeSingleFlag) return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null };
    }

    const self = {
      select() {
        return self;
      },
      insert(rows: Fila[]) {
        modo = 'insert';
        insertRows = rows;
        return self;
      },
      update(values: Fila) {
        modo = 'update';
        updateValues = values;
        return self;
      },
      delete() {
        modo = 'delete';
        return self;
      },
      eq(campo: string, valor: unknown) {
        filtros.push((f) => f[campo] === valor);
        return self;
      },
      is(campo: string, valor: null) {
        filtros.push((f) => (f[campo] ?? null) === valor);
        return self;
      },
      gt(campo: string, valor: unknown) {
        filtros.push((f) => String(f[campo]) > String(valor));
        return self;
      },
      lt(campo: string, valor: unknown) {
        filtros.push((f) => String(f[campo]) < String(valor));
        return self;
      },
      order(campo: string, opts: { ascending: boolean }) {
        orden = { campo, asc: opts.ascending };
        return self;
      },
      limit(n: number) {
        limite = n;
        return self;
      },
      single() {
        single = true;
        return ejecutar();
      },
      maybeSingle() {
        maybeSingleFlag = true;
        return ejecutar();
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return ejecutar().then(resolve, reject);
      },
    };

    return self;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

function limpiar(): void {
  vaciarCustodia();
  vaciarLimitePairing();
  resetearPurga();
}

function conClienteFake(fn: (estado: { pairing: Fila[]; devices: Fila[] }) => Promise<void>) {
  limpiar();
  const estado = { pairing: [] as Fila[], devices: [] as Fila[] };
  setClienteSupabaseDevices(() => crearClienteFake(estado));
  return fn(estado).finally(() => {
    setClienteSupabaseDevices(null);
    limpiar();
  });
}

// --- confirmarPairing: codigo vencido -----------------------------------------

test('confirmarPairing rechaza un codigo vencido', async () => {
  await conClienteFake(async (estado) => {
    estado.pairing.push({
      id: P1,
      code: '482913',
      kind: 'desktop',
      label: 'Laptop',
      token_hash: null,
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      // vencido hace 10 minutos
      expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      confirmed_at: null,
      delivered_at: null,
    });

    await assert.rejects(
      () => confirmarPairing('482913'),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 404);
        assert.match(err.message, /vencido/);
        return true;
      },
    );

    // No se creo ningun dispositivo a partir de un codigo vencido.
    assert.equal(estado.devices.length, 0);
  });
});

test('confirmarPairing rechaza un codigo que nunca existio, con el mismo mensaje que uno vencido', async () => {
  await conClienteFake(async () => {
    await assert.rejects(
      () => confirmarPairing('000000'),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 404);
        assert.match(err.message, /vencido/);
        return true;
      },
    );
  });
});

test('confirmarPairing acepta un codigo vivo y crea el dispositivo', async () => {
  await conClienteFake(async (estado) => {
    estado.pairing.push({
      id: P2,
      code: '111111',
      kind: 'agent',
      label: 'Kimi',
      token_hash: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      confirmed_at: null,
      delivered_at: null,
    });

    const resultado = await confirmarPairing('111111');
    assert.equal(resultado.label, 'Kimi');
    assert.equal(resultado.kind, 'agent');
    assert.equal(estado.devices.length, 1);
    assert.equal(estado.pairing[0]!.confirmed_at !== null, true);
  });
});

// --- consultarPairing: entrega de una sola vez --------------------------------

test('consultarPairing NO vuelve a dar el token si delivered_at ya esta seteado', async () => {
  await conClienteFake(async (estado) => {
    estado.pairing.push({
      id: P3,
      code: '222222',
      kind: 'browser',
      label: 'Chrome',
      token_hash: 'algun-hash',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      confirmed_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(), // ya se entrego antes
    });

    await assert.rejects(
      () => consultarPairing(P3),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 410);
        assert.match(err.message, /ya fue entregado/);
        return true;
      },
    );
  });
});

test('consultarPairing entrega el token la primera vez y lo bloquea en la segunda', async () => {
  await conClienteFake(async () => {
    const inicio = await iniciarPairing({ kind: 'android', label: 'Pixel' });
    const confirmado = await confirmarPairing(inicio.code);
    assert.equal(confirmado.kind, 'android');

    const primerPoll = await consultarPairing(inicio.device_id);
    assert.equal(primerPoll.status, 'confirmed');
    if (primerPoll.status !== 'confirmed') throw new Error('unreachable');
    assert.equal(typeof primerPoll.token, 'string');
    assert.ok(primerPoll.token.length > 0);

    // El segundo poll no puede volver a entregar el token: la fila ya quedo
    // marcada delivered_at, y el candado is('delivered_at', null) corta esto
    // incluso si dos polls llegaran a la vez.
    await assert.rejects(
      () => consultarPairing(inicio.device_id),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 410);
        return true;
      },
    );
  });
});

test('consultarPairing devuelve pending mientras el pairing no esta confirmado ni vencido', async () => {
  await conClienteFake(async (estado) => {
    estado.pairing.push({
      id: P4,
      code: '333333',
      kind: 'desktop',
      label: null,
      token_hash: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      confirmed_at: null,
      delivered_at: null,
    });

    const estado_ = await consultarPairing(P4);
    assert.equal(estado_.status, 'pending');
  });
});

test('consultarPairing rechaza device_id vacio sin tocar el cliente', async () => {
  await conClienteFake(async () => {
    await assert.rejects(
      () => consultarPairing(null),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 400);
        return true;
      },
    );
  });
});

// --- iniciarPairing: unicidad del codigo -------------------------------------

/**
 * Cliente que fuerza las primeras N inserciones de pairing a fallar con 23505,
 * como haria el indice unico parcial ante una colision real. Es la unica forma
 * de ejercitar el reintento: los codigos son aleatorios sobre 10^6, no se puede
 * provocar la colision "de verdad" en un test.
 */
function clienteQueDuplica(estado: { pairing: Fila[]; devices: Fila[] }, veces: number): SupabaseClient {
  const real = crearClienteFake(estado) as unknown as { from: (n: string) => Record<string, unknown> };
  let restantes = veces;
  return {
    from(nombre: string) {
      const b = real.from(nombre);
      const insertReal = (b.insert as (rows: Fila[]) => unknown).bind(b);
      b.insert = (rows: Fila[]) => {
        if (nombre !== TABLA_PAIRING || restantes <= 0) return insertReal(rows);
        restantes--;
        const fallo = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        const stub: Record<string, unknown> = {
          select: () => stub,
          single: async () => fallo,
          then: (res: (v: unknown) => unknown) => Promise.resolve(fallo).then(res),
        };
        return stub;
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

test('iniciarPairing reintenta con otro codigo cuando la base rechaza por duplicado', async () => {
  limpiar();
  const estado = { pairing: [] as Fila[], devices: [] as Fila[] };
  setClienteSupabaseDevices(() => clienteQueDuplica(estado, 2));
  try {
    const solicitud = await iniciarPairing({ kind: 'android' });
    assert.match(solicitud.code, /^[0-9]{6}$/);
    // Las dos colisiones no dejaron filas: solo entro la tercera.
    assert.equal(estado.pairing.length, 1);
  } finally {
    setClienteSupabaseDevices(null);
    limpiar();
  }
});

test('iniciarPairing se rinde con 503 si nunca consigue un codigo libre', async () => {
  limpiar();
  const estado = { pairing: [] as Fila[], devices: [] as Fila[] };
  setClienteSupabaseDevices(() => clienteQueDuplica(estado, 99));
  try {
    await assert.rejects(
      () => iniciarPairing({ kind: 'android' }),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 503);
        return true;
      },
    );
    // Y sobre todo: no quedo ninguna fila a medias.
    assert.equal(estado.pairing.length, 0);
  } finally {
    setClienteSupabaseDevices(null);
    limpiar();
  }
});

// --- iniciarPairing: frenos al abuso ----------------------------------------

test('iniciarPairing corta a un cliente que pasa su cupo, sin tocar la base', async () => {
  await conClienteFake(async (estado) => {
    for (let i = 0; i < PAIRING_MAX_POR_CLIENTE; i++) {
      await iniciarPairing({ kind: 'agent' }, { clienteId: '203.0.113.7' });
    }
    assert.equal(estado.pairing.length, PAIRING_MAX_POR_CLIENTE);

    await assert.rejects(
      () => iniciarPairing({ kind: 'agent' }, { clienteId: '203.0.113.7' }),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 429);
        return true;
      },
    );
    // El rechazo no debe escribir, y el cupo es por cliente: otra IP sigue
    // pudiendo emparejar.
    assert.equal(estado.pairing.length, PAIRING_MAX_POR_CLIENTE);
    await iniciarPairing({ kind: 'agent' }, { clienteId: '198.51.100.4' });
    assert.equal(estado.pairing.length, PAIRING_MAX_POR_CLIENTE + 1);
  });
});

test('iniciarPairing corta cuando hay demasiadas solicitudes vivas, aunque vengan de IPs distintas', async () => {
  await conClienteFake(async (estado) => {
    // Es el escenario que el cupo por cliente no cubre: muchas IPs, una
    // solicitud cada una. El tope global es lo unico que lo frena.
    for (let i = 0; i <= MAX_PAIRINGS_VIVOS; i++) {
      estado.pairing.push({
        id: uuid(),
        code: String(100000 + i),
        kind: 'agent',
        label: null,
        token_hash: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        confirmed_at: null,
        delivered_at: null,
      });
    }

    await assert.rejects(
      () => iniciarPairing({ kind: 'agent' }, { clienteId: 'ip-nueva' }),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 429);
        assert.match(err.message, /abiertos/);
        return true;
      },
    );
  });
});

test('iniciarPairing purga las solicitudes vencidas y nunca confirmadas', async () => {
  await conClienteFake(async (estado) => {
    const vieja: Fila = {
      id: uuid(),
      code: '424242',
      kind: 'agent',
      label: null,
      token_hash: null,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      confirmed_at: null,
      delivered_at: null,
    };
    // Una confirmada y vencida NO se purga: es la auditoria de un dispositivo
    // que existe de verdad.
    const confirmada: Fila = { ...vieja, id: uuid(), code: '424243', confirmed_at: new Date().toISOString() };
    estado.pairing.push(vieja, confirmada);

    await iniciarPairing({ kind: 'agent' }, { clienteId: 'ip-limpia' });

    assert.equal(estado.pairing.some((f) => f.code === '424242'), false, 'la vencida sin confirmar deberia irse');
    assert.equal(estado.pairing.some((f) => f.code === '424243'), true, 'la confirmada se conserva');
  });
});

// --- confirmarPairing: ambiguedad --------------------------------------------

test('confirmarPairing NO elige entre dos solicitudes vivas con el mismo codigo', async () => {
  await conClienteFake(async (estado) => {
    // Solo puede pasar si el indice unico parcial no esta aplicado. La version
    // anterior se quedaba con la mas nueva, y eso permitia que un atacante que
    // spamea pair/start se llevara el pairing que Pancho creia confirmar.
    const base = {
      code: '777777',
      kind: 'android',
      label: 'ambigua',
      token_hash: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      confirmed_at: null,
      delivered_at: null,
    };
    estado.pairing.push({ ...base, id: uuid() }, { ...base, id: uuid(), label: 'del atacante' });

    await assert.rejects(
      () => confirmarPairing('777777'),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 409);
        return true;
      },
    );
    // Y lo que importa de verdad: no nacio ningun token para nadie.
    assert.equal(estado.devices.length, 0);
    assert.equal(estado.pairing.every((f) => f.confirmed_at === null), true);
  });
});

// --- consultarPairing: credencial huerfana -----------------------------------

test('consultarPairing revoca el dispositivo si el token se perdio en un reinicio', async () => {
  await conClienteFake(async (estado) => {
    const inicio = await iniciarPairing({ kind: 'desktop', label: 'Laptop' });
    await confirmarPairing(inicio.code);
    assert.equal(estado.devices.length, 1);
    assert.equal(estado.devices[0]!.revoked_at ?? null, null);

    // Simula el reinicio de PM2 entre el confirm y el primer poll: la custodia
    // en memoria se vacia y el token crudo ya no existe en ningun lado.
    vaciarCustodia();

    await assert.rejects(
      () => consultarPairing(inicio.device_id),
      (err: unknown) => {
        assert.ok(err instanceof ErrorDispositivos);
        assert.equal(err.status, 410);
        assert.match(err.message, /se perdio/);
        return true;
      },
    );

    // La fila no puede quedar activa: seria una credencial que nadie puede usar
    // y que igual figura como dispositivo valido en /sistema.
    assert.equal(estado.devices.length, 1, 'la fila se conserva para auditoria');
    assert.notEqual(estado.devices[0]!.revoked_at ?? null, null, 'pero revocada');
  });
});

// --- validacion de ids -------------------------------------------------------

test('los ids que no son uuid dan 400, no un 502 con el mensaje de Postgres', async () => {
  await conClienteFake(async () => {
    for (const malo of ['fake-1', '../../etc', '1 or 1=1']) {
      await assert.rejects(
        () => consultarPairing(malo),
        (err: unknown) => {
          assert.ok(err instanceof ErrorDispositivos, `consultarPairing con ${malo}`);
          assert.equal(err.status, 400);
          return true;
        },
      );
      await assert.rejects(
        () => revocarDispositivo(malo),
        (err: unknown) => {
          assert.ok(err instanceof ErrorDispositivos, `revocarDispositivo con ${malo}`);
          assert.equal(err.status, 400);
          return true;
        },
      );
    }
  });
});
