// Contrato de config.handlers.ts sin tocar Supabase real: se inyecta un doble
// en memoria via setClienteSupabaseConfig. Mismo molde que
// journal.handlers.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  guardarConfig,
  normalizarConfigKey,
  obtenerConfig,
  setClienteSupabaseConfig,
} from './config.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado { os_config: Fila[] }

function crearClienteFake(estado: Estado): SupabaseClient {
  function builder() {
    let modo: 'select' | 'upsert' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let upsertRow: Fila = {};
    let single = false;
    let maybeSingle = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = estado.os_config;

      if (modo === 'upsert') {
        const idx = filas.findIndex((f) => f.key === upsertRow.key);
        if (idx >= 0) filas[idx] = { ...filas[idx], ...upsertRow };
        else filas.push({ ...upsertRow });
        const fila = filas.find((f) => f.key === upsertRow.key) ?? null;
        return { data: fila, error: null };
      }

      const resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      if (maybeSingle) return { data: resultado[0] ?? null, error: null };
      if (single) {
        return resultado[0]
          ? { data: resultado[0], error: null }
          : { data: null, error: { message: 'no rows returned', code: 'PGRST116' } };
      }
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      upsert(row: Fila, _opts?: unknown) { modo = 'upsert'; upsertRow = row; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      single() { single = true; return ejecutar(); },
      maybeSingle() { maybeSingle = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };

    return self;
  }

  return { from: () => builder() } as unknown as SupabaseClient;
}

function conClienteFake(fn: (estado: Estado) => Promise<void>) {
  const estado: Estado = { os_config: [] };
  setClienteSupabaseConfig(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabaseConfig(null));
}

test('normalizarConfigKey acepta kebab-case y rechaza el resto', () => {
  assert.equal(normalizarConfigKey('bottom_nav'), 'bottom_nav');
  assert.equal(normalizarConfigKey('bottom-nav'), 'bottom-nav');
  assert.throws(() => normalizarConfigKey(''), /key invalida/);
  assert.throws(() => normalizarConfigKey('Bottom Nav'), /key invalida/);
  assert.throws(() => normalizarConfigKey('1nav'), /key invalida/);
});

test('obtenerConfig devuelve null si la key no existe', async () => {
  await conClienteFake(async () => {
    assert.equal(await obtenerConfig('bottom_nav'), null);
  });
});

test('guardarConfig crea la fila y obtenerConfig la recupera', async () => {
  await conClienteFake(async (estado) => {
    const guardada = await guardarConfig('bottom_nav', ['/', '/tareas', '/agenda']);
    assert.deepEqual(guardada.value, ['/', '/tareas', '/agenda']);
    assert.equal(estado.os_config.length, 1);

    const leida = await obtenerConfig('bottom_nav');
    assert.deepEqual(leida?.value, ['/', '/tareas', '/agenda']);
  });
});

test('guardarConfig sobre una key existente actualiza en vez de duplicar', async () => {
  await conClienteFake(async (estado) => {
    await guardarConfig('bottom_nav', ['/']);
    await guardarConfig('bottom_nav', ['/', '/salud']);
    assert.equal(estado.os_config.length, 1);
    assert.deepEqual(estado.os_config[0]!.value, ['/', '/salud']);
  });
});

test('guardarConfig exige value', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => guardarConfig('bottom_nav', undefined), /value requerido/);
  });
});
