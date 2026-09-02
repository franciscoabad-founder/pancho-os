import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarEvento } from './motor.ts';

// Helper to create a mock Supabase client
function createMockSb(options = {}) {
  const {
    jugador = { id: 'jugador-1', xp_total: 100, oro: 50, hp: 10, hp_max: 20, config: {} },
    rpcError = false,
    insertError = false,
    insertErrorCode = null
  } = options;

  let insertedEvents = [];
  let updatedJugador = null;
  let rpcCalls = [];

  const sb = {
    from: (tabla) => ({
      select: () => ({
        limit: () => Promise.resolve({
          data: tabla === 'jugador' ? [jugador] : [],
          error: null
        })
      }),
      insert: (data) => {
        if (insertError) {
          return Promise.resolve({ error: { code: insertErrorCode } });
        }
        insertedEvents.push({ tabla, data });
        return Promise.resolve({ error: null });
      },
      update: (data) => ({
        eq: (col, val) => {
          updatedJugador = data;
          return Promise.resolve({ error: null });
        }
      })
    }),
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      if (rpcError) {
        return Promise.resolve({ error: new Error('RPC Error') });
      }
      if (fn === 'juego_incrementar') {
        const oroPerdido = args.p_oro < 0 ? -args.p_oro : 0;

        let newOro = args.p_oro < 0 ? jugador.oro - oroPerdido : jugador.oro + (args.p_oro || 0);

        return Promise.resolve({
          data: [{
            xp_total: jugador.xp_total + (args.p_xp || 0),
            oro: newOro,
            hp: Math.min(jugador.hp_max, Math.max(0, jugador.hp + (args.p_hp || 0)))
          }],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    // Expose internal state for assertions
    _getState: () => ({ insertedEvents, updatedJugador, rpcCalls })
  };

  return sb;
}

test('registrarEvento: happy path (RPC success)', async () => {
  const sb = createMockSb();
  const rng = () => 0.99; // no loot

  const res = await registrarEvento(sb, {
    tipo: 'tarea_hecha',
    ref_tabla: 'tareas',
    ref_id: 't1',
    meta: { prioridad: 'high' }
  }, rng);

  assert.ok(res, 'Debería devolver el resultado del evento');
  assert.equal(res.xp, 15);
  assert.equal(res.oro, 8);
  assert.equal(res.hp, 10); // Sin cambios

  const state = sb._getState();

  // 1. Debe haber insertado el evento
  assert.equal(state.insertedEvents.length, 1);
  assert.equal(state.insertedEvents[0].tabla, 'xp_events');
  assert.equal(state.insertedEvents[0].data.tipo, 'tarea_hecha');
  assert.equal(state.insertedEvents[0].data.xp, 15);
  assert.equal(state.insertedEvents[0].data.oro, 8);

  // 2. Debe haber llamado a RPC
  assert.equal(state.rpcCalls.length, 1);
  assert.equal(state.rpcCalls[0].fn, 'juego_incrementar');
  assert.equal(state.rpcCalls[0].args.p_xp, 15);
  assert.equal(state.rpcCalls[0].args.p_oro, 8);

  // 3. No debe haber llamado a update en fallback
  assert.equal(state.updatedJugador, null);
});

test('registrarEvento: death condition (hp <= 0)', async () => {
  const sb = createMockSb();
  const rng = () => 0.99; // no loot

  const res = await registrarEvento(sb, {
    tipo: 'diaria_fallo',
    hp: -20, // hp inicial es 10, -20 lo lleva a <= 0
  }, rng);

  assert.ok(res);
  assert.ok(res.muerte);
  assert.equal(res.muerte.oroPerdido, 25); // Pierde el 50% de 50 de oro
  assert.equal(res.hp, 20); // hp_max = 20

  const state = sb._getState();

  // Debe haber registrado el evento original y la muerte
  const eventoOriginal = state.insertedEvents.find(e => e.data.tipo === 'diaria_fallo');
  const eventoMuerte = state.insertedEvents.find(e => e.data.tipo === 'muerte');

  assert.ok(eventoOriginal);
  assert.ok(eventoMuerte);
  assert.equal(eventoMuerte.data.oro, -25);

  // Debe haber 2 llamadas RPC (una para el evento, otra para ajustar oro y curar HP)
  assert.equal(state.rpcCalls.length, 2);
  assert.equal(state.rpcCalls[0].args.p_hp, -20);
  assert.equal(state.rpcCalls[1].args.p_oro, -25);
  assert.equal(state.rpcCalls[1].args.p_hp, 20);
});

test('registrarEvento: unique constraint violation returns null', async () => {
  const sb = createMockSb({ insertError: true, insertErrorCode: '23505' });
  const rng = () => 0.99; // no loot

  const res = await registrarEvento(sb, {
    tipo: 'tarea_hecha',
    ref_tabla: 'tareas',
    ref_id: 't1'
  }, rng);

  assert.equal(res, null);
});

test('registrarEvento: loot dropping adds extra oro and loot event', async () => {
  const sb = createMockSb();
  const rng = () => 0.01; // Fuerza un loot drop

  const res = await registrarEvento(sb, {
    tipo: 'tarea_hecha',
    meta: { prioridad: 'high', valor: 5 } // Racha 5
  }, rng);

  assert.ok(res);
  assert.ok(res.loot);
  assert.ok(res.loot.oro > 0);
  assert.ok(res.oro > 8); // 8 base de la tarea (high) + oro del loot

  const state = sb._getState();

  // Debe haber 2 eventos: tarea_hecha y loot
  assert.equal(state.insertedEvents.length, 2);
  const eventoLoot = state.insertedEvents.find(e => e.data.tipo === 'loot');
  assert.ok(eventoLoot);
  assert.equal(eventoLoot.data.oro, res.loot.oro);

  // El RPC debe ser llamado con el oro base + el oro del loot
  assert.equal(state.rpcCalls[0].args.p_oro, res.oro);
});

test('registrarEvento: fallback path (RPC error)', async () => {
  const sb = createMockSb({ rpcError: true });
  const rng = () => 0.99; // no loot

  const res = await registrarEvento(sb, {
    tipo: 'tarea_hecha',
    meta: { prioridad: 'high' }
  }, rng);

  assert.ok(res);
  assert.equal(res.xp, 15);
  assert.equal(res.oro, 8);

  const state = sb._getState();

  // 1. Intentó llamar a RPC
  assert.equal(state.rpcCalls.length, 1);

  // 2. Cayó en el fallback y actualizó jugador manualmente
  assert.ok(state.updatedJugador);
  assert.equal(state.updatedJugador.xp_total, 115); // 100 + 15
  assert.equal(state.updatedJugador.oro, 58); // 50 + 8
  assert.equal(state.updatedJugador.hp, 10); // 10 + 0
});
