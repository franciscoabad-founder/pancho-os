// Contrato de notas.handlers.ts sin tocar Supabase real: se inyecta un doble
// en memoria via setClienteSupabaseNotas.

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  actualizarNota,
  convertirNota,
  crearNota,
  eliminarNota,
  listarNotas,
  setClienteSupabaseNotas,
} from './notas.handlers.ts';

const TABLA_NOTAS = 'notas';
const TABLA_PENDIENTES = 'pendientes';
const TABLA_TAREAS = 'tareas';
const TABLA_RECORDATORIOS = 'recordatorios';

type Fila = Record<string, unknown>;

function crearClienteFake(estado: {
  notas: Fila[];
  pendientes: Fila[];
  tareas: Fila[];
  recordatorios: Fila[];
}): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === TABLA_NOTAS) return estado.notas;
    if (nombre === TABLA_PENDIENTES) return estado.pendientes;
    if (nombre === TABLA_TAREAS) return estado.tareas;
    if (nombre === TABLA_RECORDATORIOS) return estado.recordatorios;
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

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = tabla(nombre);

      if (modo === 'insert') {
        const nuevas = insertRows.map((r) => ({
          id: randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...r,
        }));
        filas.push(...nuevas);
        return { data: single ? nuevas[0] : nuevas, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        const data = single ? (coincidencias[0] ?? null) : coincidencias;
        return { data, error: null };
      }

      if (modo === 'delete') {
        const borradas = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of borradas) filas.splice(filas.indexOf(f), 1);
        const data = single ? (borradas[0] ?? null) : borradas;
        return { data, error: null };
      }

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
      order(campo: string, opts: { ascending: boolean }) {
        orden = { campo, asc: opts.ascending };
        return self;
      },
      single() {
        single = true;
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

function conClienteFake(
  fn: (estado: {
    notas: Fila[];
    pendientes: Fila[];
    tareas: Fila[];
    recordatorios: Fila[];
  }) => Promise<void>,
) {
  const estado = { notas: [] as Fila[], pendientes: [] as Fila[], tareas: [] as Fila[], recordatorios: [] as Fila[] };
  setClienteSupabaseNotas(() => crearClienteFake(estado));
  return fn(estado).finally(() => {
    setClienteSupabaseNotas(null);
  });
}

// --- CRUD basico --------------------------------------------------------------

test('listarNotas devuelve notas ordenadas por created_at descendente', async () => {
  await conClienteFake(async (estado) => {
    estado.notas.push(
      { id: randomUUID(), contenido: 'A', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: randomUUID(), contenido: 'B', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
    );
    const notas = await listarNotas();
    assert.equal(notas.length, 2);
    assert.equal(notas[0]!.contenido, 'B');
  });
});

test('crearNota exige contenido', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearNota({ contenido: '   ' }), /contenido requerido/);
  });
});

test('crearNota guarda tags como array', async () => {
  await conClienteFake(async (estado) => {
    const nota = await crearNota({ contenido: 'Hola', tags: ['idea'] });
    assert.equal(nota.contenido, 'Hola');
    assert.deepEqual(nota.tags, ['idea']);
    assert.equal(estado.notas.length, 1);
  });
});

test('actualizarNota valida estado permitido', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'X', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    await assert.rejects(() => actualizarNota(id, { estado: 'borrada' }), /estado invalido/);
  });
});

test('actualizarNota actualiza contenido y estado', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'X', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    const nota = await actualizarNota(id, { contenido: 'Y', estado: 'archivada' });
    assert.equal(nota.contenido, 'Y');
    assert.equal(nota.estado, 'archivada');
  });
});

test('eliminarNota borra la fila', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'X', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    await eliminarNota(id);
    assert.equal(estado.notas.length, 0);
  });
});

// --- conversiones --------------------------------------------------------------

test('convertirNota a pendiente crea pendiente y marca la nota', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'Comprar leche', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    const resultado = await convertirNota({ id, a: 'pendiente', payload: { proyecto: 'Casa' } });
    assert.equal(resultado.destino, 'pendiente');
    assert.equal(resultado.nota.estado, 'convertida');
    assert.equal(resultado.nota.convertida_a, 'pendiente');
    assert.equal(estado.pendientes.length, 1);
    assert.equal(estado.pendientes[0]!.proyecto, 'Casa');
  });
});

test('convertirNota a tarea respeta prioridad y grupo', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'Hacer deploy', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    const resultado = await convertirNota({ id, a: 'tarea', payload: { prioridad: 'high', grupo: 'infra', deadline: '2026-08-25' } });
    assert.equal(resultado.destino, 'tarea');
    assert.equal(estado.tareas.length, 1);
    assert.equal(estado.tareas[0]!.prioridad, 'high');
    assert.equal(estado.tareas[0]!.grupo, 'infra');
  });
});

test('convertirNota a recordatorio exige recordar_at', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'Llamar', tags: [], estado: 'activa', convertida_a: null, convertida_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    await assert.rejects(() => convertirNota({ id, a: 'recordatorio', payload: {} }), /recordar_at requerido/);
    assert.equal(estado.recordatorios.length, 0);
  });
});

test('convertirNota rechaza destinos invalidos', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => convertirNota({ id: randomUUID(), a: 'tarea-inexistente' }), /convertir.a debe ser/);
  });
});

test('convertirNota rechaza notas ya convertidas', async () => {
  await conClienteFake(async (estado) => {
    const id = randomUUID();
    estado.notas.push({ id, contenido: 'X', tags: [], estado: 'convertida', convertida_a: 'tarea', convertida_id: randomUUID(), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    await assert.rejects(() => convertirNota({ id, a: 'pendiente' }), /ya fue convertida/);
  });
});
