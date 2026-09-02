import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  obtenerPrincipios,
  setClienteSupabasePrincipios,
} from './principios.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado { os_principios: Fila[] }

function crearClienteFake(estado: Estado): SupabaseClient {
  function builder() {
    let orderParams: { column: string; ascending: boolean } | null = null;
    let single = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      let filas = [...estado.os_principios];

      if (orderParams) {
        filas.sort((a, b) => {
          const valA = a[orderParams!.column] as number;
          const valB = b[orderParams!.column] as number;
          if (orderParams!.ascending) return valA - valB;
          return valB - valA;
        });
      }

      if (single) {
        return filas[0]
          ? { data: filas[0], error: null }
          : { data: null, error: { message: 'no rows returned', code: 'PGRST116' } };
      }
      return { data: filas, error: null };
    }

    const self = {
      select() { return self; },
      order(column: string, opts?: { ascending?: boolean }) {
        orderParams = { column, ascending: opts?.ascending ?? true };
        return self;
      },
      single() { single = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };

    return self;
  }

  return { from: () => builder() } as unknown as SupabaseClient;
}

function conClienteFake(fn: (estado: Estado) => Promise<void>) {
  const estado: Estado = { os_principios: [] };
  setClienteSupabasePrincipios(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabasePrincipios(null));
}

test('obtenerPrincipios devuelve array vacio si no hay datos', async () => {
  await conClienteFake(async (estado) => {
    const res = await obtenerPrincipios();
    assert.deepEqual(res, []);
  });
});

test('obtenerPrincipios devuelve los principios ordenados por "orden"', async () => {
  await conClienteFake(async (estado) => {
    estado.os_principios = [
      { id: '2', texto: 'Dos', orden: 2 },
      { id: '1', texto: 'Uno', orden: 1 },
      { id: '3', texto: 'Tres', orden: 3 },
    ];

    const res = await obtenerPrincipios();
    assert.equal(res.length, 3);
    assert.equal(res[0]!.texto, 'Uno');
    assert.equal(res[1]!.texto, 'Dos');
    assert.equal(res[2]!.texto, 'Tres');
  });
});
