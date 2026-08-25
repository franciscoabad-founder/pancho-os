// Contrato de red.handlers.ts sin tocar Supabase real. Mismo molde que
// ikigai.handlers.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  archivarPersona,
  conectarPersonas,
  crearPersona,
  crearPlan,
  listarPersonas,
  obtenerDiagnostico,
  registrarContacto,
  setClienteSupabaseRed,
} from './red.handlers.ts';

type Fila = Record<string, unknown>;
interface Estado {
  personas: Fila[];
  conexiones: Fila[];
  planes: Fila[];
  objetivos: Fila[];
}

function crearClienteFake(estado: Estado): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === 'os_red_personas') return estado.personas;
    if (nombre === 'os_red_conexiones') return estado.conexiones;
    if (nombre === 'os_red_planes') return estado.planes;
    if (nombre === 'os_red_objetivos') return estado.objetivos;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function defaultsDe(nombre: string): Fila {
    const base = { id: randomUUID(), created_at: new Date().toISOString() };
    if (nombre === 'os_red_personas') return { ...base, ultima_interaccion: null, notas: null, activo: true };
    if (nombre === 'os_red_conexiones') return { ...base };
    if (nombre === 'os_red_planes') return { ...base, horizonte_fin: null, frontera: null, activo: true };
    if (nombre === 'os_red_objetivos') return { ...base, tactica: null, estado: 'pendiente' };
    return base;
  }

  function builder(nombre: string) {
    let modo: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila[] = [];
    let updateValues: Fila = {};
    let upsertKeys: string[] = [];
    let ignoreDup = false;
    const ordenes: Array<{ campo: string; asc: boolean }> = [];
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
            if (!ignoreDup) Object.assign(existente, r);
            // ignoreDuplicates: no se devuelve fila (imita comportamiento real de postgrest)
          } else {
            const nueva = { ...defaultsDe(nombre), ...r };
            filas.push(nueva);
            resultados.push(nueva);
          }
        }
        return { data: single ? (resultados[0] ?? null) : resultados, error: null };
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
      if (single) {
        return resultado[0]
          ? { data: resultado[0], error: null }
          : { data: null, error: { message: 'no rows returned', code: 'PGRST116' } };
      }
      if (maybeSingleMode) return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      insert(rows: Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      upsert(rows: Fila[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
        modo = 'upsert';
        insertRows = rows;
        upsertKeys = opts.onConflict.split(',');
        ignoreDup = opts.ignoreDuplicates ?? false;
        return self;
      },
      update(values: Fila) { modo = 'update'; updateValues = values; return self; },
      delete() { modo = 'delete'; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      order(campo: string, opts?: { ascending: boolean }) { ordenes.push({ campo, asc: opts?.ascending ?? true }); return self; },
      single() { single = true; return ejecutar(); },
      maybeSingle() { maybeSingleMode = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };

    return self;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

function conClienteFake(fn: (estado: Estado) => Promise<void>) {
  const estado: Estado = { personas: [], conexiones: [], planes: [], objetivos: [] };
  setClienteSupabaseRed(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabaseRed(null));
}

// --- Personas ---------------------------------------------------------------

test('crearPersona: exige nombre', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearPersona({ tipo_lazo: 'personal' }), /nombre requerido/);
  });
});

test('crearPersona: rechaza tipo_lazo invalido', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearPersona({ nombre: 'Ana', tipo_lazo: 'inversor' }), /tipo_lazo invalido/);
  });
});

test('crearPersona: deriva iniciales del nombre si no se dan', async () => {
  await conClienteFake(async () => {
    const p = await crearPersona({ nombre: 'Michelle Arevalo', tipo_lazo: 'personal' });
    assert.equal(p.iniciales, 'MA');
  });
});

test('crearPersona: cercania fuera de rango cae al default 2', async () => {
  await conClienteFake(async () => {
    const p = await crearPersona({ nombre: 'Ana', tipo_lazo: 'personal', cercania: 9 });
    assert.equal(p.cercania, 2);
  });
});

test('registrarContacto: actualiza ultima_interaccion', async () => {
  await conClienteFake(async () => {
    const p = await crearPersona({ nombre: 'Ana', tipo_lazo: 'personal' });
    const actualizada = await registrarContacto(p.id, '2026-08-25');
    assert.equal(actualizada.ultima_interaccion, '2026-08-25');
  });
});

test('archivarPersona: desactiva, no borra', async () => {
  await conClienteFake(async (estado) => {
    const p = await crearPersona({ nombre: 'Ana', tipo_lazo: 'personal' });
    await archivarPersona(p.id);
    const fila = estado.personas.find((f) => f.id === p.id);
    assert.equal(fila?.activo, false);
    assert.equal((await listarPersonas(true)).length, 0);
    assert.equal((await listarPersonas(false)).length, 1);
  });
});

// --- Conexiones ---------------------------------------------------------

test('conectarPersonas: rechaza conectar una persona consigo misma', async () => {
  await conClienteFake(async () => {
    const p = await crearPersona({ nombre: 'Ana', tipo_lazo: 'personal' });
    await assert.rejects(() => conectarPersonas(p.id, p.id), /no puede conectarse consigo misma/);
  });
});

test('conectarPersonas: normaliza el orden del par, evita duplicado espejo', async () => {
  await conClienteFake(async (estado) => {
    const a = await crearPersona({ nombre: 'Ana', tipo_lazo: 'personal' });
    const b = await crearPersona({ nombre: 'Beto', tipo_lazo: 'personal' });
    await conectarPersonas(a.id, b.id);
    await conectarPersonas(b.id, a.id); // orden invertido, misma conexion
    assert.equal(estado.conexiones.length, 1);
  });
});

// --- Diagnostico -------------------------------------------------------

test('obtenerDiagnostico: red vacia no explota', async () => {
  await conClienteFake(async () => {
    const d = await obtenerDiagnostico();
    assert.equal(d.totalPersonas, 0);
    assert.equal(d.apertura.densidad, 0);
    assert.equal(d.limiteRecomendado, 16);
  });
});

test('obtenerDiagnostico: solo cuenta personas activas', async () => {
  await conClienteFake(async () => {
    const a = await crearPersona({ nombre: 'Ana', tipo_lazo: 'estrategico' });
    await crearPersona({ nombre: 'Beto', tipo_lazo: 'personal' });
    await archivarPersona(a.id);
    const d = await obtenerDiagnostico();
    assert.equal(d.totalPersonas, 1);
  });
});

// --- Plan ---------------------------------------------------------------

test('crearPlan: exige meta', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearPlan(''), /meta requerido/);
  });
});

test('crearPlan: el segundo desactiva al primero', async () => {
  await conClienteFake(async (estado) => {
    const p1 = await crearPlan('Meta 1', 'Frontera 1');
    await crearPlan('Meta 2', 'Frontera 2');
    const anterior = estado.planes.find((p) => p.id === p1.id);
    assert.equal(anterior?.activo, false);
  });
});
