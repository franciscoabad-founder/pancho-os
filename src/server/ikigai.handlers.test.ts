// Contrato de ikigai.handlers.ts sin tocar Supabase real: cliente fake en
// memoria, mismo molde que journal.handlers.test.ts, extendido con
// maybeSingle (que journal no necesitaba).

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  agregarItem,
  crearNuevoMapa,
  crearZona,
  eliminarItem,
  obtenerEstado,
  obtenerMapaActivo,
  registrarPulso,
  setClienteSupabaseIkigai,
  tendenciaDeZona,
} from './ikigai.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado {
  mapas: Fila[];
  items: Fila[];
  zonas: Fila[];
  pulsos: Fila[];
}

function crearClienteFake(estado: Estado): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === 'os_ikigai_mapas') return estado.mapas;
    if (nombre === 'os_ikigai_items') return estado.items;
    if (nombre === 'os_ikigai_zonas') return estado.zonas;
    if (nombre === 'os_ikigai_pulsos') return estado.pulsos;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function defaultsDe(nombre: string): Fila {
    if (nombre === 'os_ikigai_mapas') return { id: randomUUID(), created_at: new Date().toISOString(), titulo: null, nota: null, activo: true };
    if (nombre === 'os_ikigai_items') return { id: randomUUID(), created_at: new Date().toISOString(), orden: 0 };
    if (nombre === 'os_ikigai_zonas') return { id: randomUUID(), created_at: new Date().toISOString(), cuadrantes: [], descripcion: null, objetivo_ref: null, orden: 0 };
    if (nombre === 'os_ikigai_pulsos') return { id: randomUUID(), created_at: new Date().toISOString(), nota: null };
    return {};
  }

  function builder(nombre: string) {
    let modo: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila[] = [];
    let updateValues: Fila = {};
    let upsertKeys: string[] = [];
    const ordenes: Array<{ campo: string; asc: boolean }> = [];
    let limite: number | null = null;
    let single = false;
    let maybeSingleMode = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = tabla(nombre);

      if (modo === 'insert') {
        const nuevas = insertRows.map((r) => ({ ...defaultsDe(nombre), ...r }));
        filas.push(...nuevas);
        return { data: single ? nuevas[0] : nuevas, error: null };
      }

      if (modo === 'upsert') {
        const resultados: Fila[] = [];
        for (const r of insertRows) {
          const existente = filas.find((f) => upsertKeys.every((k) => f[k] === r[k]));
          if (existente) {
            Object.assign(existente, r);
            resultados.push(existente);
          } else {
            const nueva = { ...defaultsDe(nombre), ...r };
            filas.push(nueva);
            resultados.push(nueva);
          }
        }
        return { data: null, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        return { data: single ? (coincidencias[0] ?? null) : coincidencias, error: null };
      }

      if (modo === 'delete') {
        const borradas = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of borradas) filas.splice(filas.indexOf(f), 1);
        return { data: null, error: null };
      }

      let resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      for (const { campo, asc } of [...ordenes].reverse()) {
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
      if (maybeSingleMode) {
        return { data: resultado[0] ?? null, error: null };
      }
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      insert(rows: Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      upsert(rows: Fila[], opts: { onConflict: string }) {
        modo = 'upsert';
        insertRows = rows;
        upsertKeys = opts.onConflict.split(',');
        return self;
      },
      update(values: Fila) { modo = 'update'; updateValues = values; return self; },
      delete() { modo = 'delete'; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      order(campo: string, opts?: { ascending: boolean }) { ordenes.push({ campo, asc: opts?.ascending ?? true }); return self; },
      limit(n: number) { limite = n; return self; },
      single() { single = true; return ejecutar(); },
      maybeSingle() { maybeSingleMode = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };

    return self;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

function conClienteFake(fn: (estado: Estado) => Promise<void>) {
  const estado: Estado = { mapas: [], items: [], zonas: [], pulsos: [] };
  setClienteSupabaseIkigai(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabaseIkigai(null));
}

// --- Mapa activo -----------------------------------------------------------

test('obtenerMapaActivo: sin mapas => null', async () => {
  await conClienteFake(async () => {
    assert.equal(await obtenerMapaActivo(), null);
  });
});

test('crearNuevoMapa: el primero es version 1, activo', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    assert.equal(m.version, 1);
    assert.equal(m.activo, true);
  });
});

test('crearNuevoMapa: el segundo desactiva el anterior y sube de version', async () => {
  await conClienteFake(async (estado) => {
    const m1 = await crearNuevoMapa('Primero');
    const m2 = await crearNuevoMapa('Segundo');
    assert.equal(m2.version, 2);
    const anterior = estado.mapas.find((m) => m.id === m1.id);
    assert.equal(anterior?.activo, false);
    assert.equal((await obtenerMapaActivo())?.id, m2.id);
  });
});

// --- Items y zonas -----------------------------------------------------

test('agregarItem: rechaza cuadrante invalido', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    await assert.rejects(() => agregarItem(m.id, 'inventado', 'texto'), /cuadrante invalido/);
  });
});

test('agregarItem: rechaza texto vacio', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    await assert.rejects(() => agregarItem(m.id, 'amas', '   '), /texto requerido/);
  });
});

test('eliminarItem: exige id', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => eliminarItem(null), /id requerido/);
  });
});

test('obtenerEstado: sin mapa activo devuelve cobertura vacia sin explotar', async () => {
  await conClienteFake(async () => {
    const estado = await obtenerEstado();
    assert.equal(estado.mapa, null);
    assert.deepEqual(estado.cobertura.huecos.sort(), ['amas', 'bueno', 'mundo', 'pagan']);
  });
});

test('obtenerEstado: clasifica zonas correctamente dentro del estado completo', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    await crearZona(m.id, 'BrainTech', ['amas', 'bueno']);
    const estado = await obtenerEstado();
    assert.equal(estado.zonas[0].clasificacion, 'pasion');
    assert.deepEqual(estado.cobertura.huecos.sort(), ['mundo', 'pagan']);
  });
});

// --- Pulso ------------------------------------------------------------------

test('registrarPulso: rechaza nivel fuera de 1-5', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    const z = await crearZona(m.id, 'Familia', ['amas']);
    await assert.rejects(() => registrarPulso(z.id, '2026-08', 7), /nivel invalido/);
  });
});

test('registrarPulso: rechaza periodo mal formado', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    const z = await crearZona(m.id, 'Familia', ['amas']);
    await assert.rejects(() => registrarPulso(z.id, '2026-8', 3), /periodo invalido/);
  });
});

test('registrarPulso: repetir el mismo periodo actualiza, no duplica', async () => {
  await conClienteFake(async (estado) => {
    const m = await crearNuevoMapa();
    const z = await crearZona(m.id, 'Familia', ['amas']);
    await registrarPulso(z.id, '2026-08', 3);
    await registrarPulso(z.id, '2026-08', 5);
    const delZona = estado.pulsos.filter((p) => p.zona_id === z.id);
    assert.equal(delZona.length, 1);
    assert.equal(delZona[0].nivel, 5);
  });
});

test('tendenciaDeZona: sin pulsos => sin_datos', async () => {
  await conClienteFake(async () => {
    const m = await crearNuevoMapa();
    const z = await crearZona(m.id, 'Familia', ['amas']);
    assert.equal(await tendenciaDeZona(z.id), 'sin_datos');
  });
});
