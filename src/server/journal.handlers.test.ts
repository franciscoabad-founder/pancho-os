// Contrato de journal.handlers.ts sin tocar Supabase real: se inyecta un doble
// en memoria via setClienteSupabaseJournal. Mismo molde que
// notas.handlers.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  actualizarEntrada,
  componerMarkdownDia,
  crearEntrada,
  detectarSugerencias,
  eliminarEntrada,
  listarEntradas,
  promoverAContenido,
  setClienteSupabaseJournal,
  slugDelDia,
  type EntradaJournal,
} from './journal.handlers.ts';
import { setEscritorBrain, sincronizarDiaAlBrain } from './journal.brain.handlers.ts';

test('detectarSugerencias ofrece tareas y personas sin ejecutar acciones', () => {
  assert.deepEqual(detectarSugerencias('Debo llamar a Ana. Coordinar con @Carlos mañana.'), {
    tareas: ['llamar a Ana'],
    personas: ['Carlos'],
  });
});

type Fila = Record<string, unknown>;
interface Estado { journal: Fila[]; ideas: Fila[] }

function crearClienteFake(estado: Estado): SupabaseClient {
  function tabla(nombre: string): Fila[] {
    if (nombre === 'os_journal') return estado.journal;
    if (nombre === 'os_contenido_ideas') return estado.ideas;
    throw new Error(`tabla fake no soportada: ${nombre}`);
  }

  function builder(nombre: string) {
    let modo: 'select' | 'insert' | 'update' | 'delete' = 'select';
    const filtros: Array<(f: Fila) => boolean> = [];
    let insertRows: Fila[] = [];
    let updateValues: Fila = {};
    const ordenes: Array<{ campo: string; asc: boolean }> = [];
    let limite: number | null = null;
    let single = false;

    async function ejecutar(): Promise<{ data: unknown; error: unknown }> {
      const filas = tabla(nombre);

      if (modo === 'insert') {
        const nuevas = insertRows.map((r) => ({
          id: randomUUID(),
          created_at: new Date().toISOString(),
          fecha: new Date().toISOString().slice(0, 10),
          tipo: 'dia',
          titulo: null,
          tags: [],
          fuente: 'os',
          proyecto: null,
          publicable: false,
          brain_slug: null,
          ...r,
        }));
        filas.push(...nuevas);
        return { data: single ? nuevas[0] : nuevas, error: null };
      }

      if (modo === 'update') {
        const coincidencias = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of coincidencias) Object.assign(f, updateValues);
        return { data: single ? (coincidencias[0] ?? null) : coincidencias, error: null };
      }

      if (modo === 'delete') {
        const borradas = filas.filter((f) => filtros.every((fn) => fn(f)));
        for (const f of borradas) filas.splice(filas.indexOf(f), 1);
        return { data: single ? (borradas[0] ?? null) : borradas, error: null };
      }

      let resultado = filas.filter((f) => filtros.every((fn) => fn(f)));
      // Orden estable aplicando las claves en orden inverso, igual que hace
      // PostgREST con .order() encadenado.
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
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      insert(rows: Fila[]) { modo = 'insert'; insertRows = rows; return self; },
      update(values: Fila) { modo = 'update'; updateValues = values; return self; },
      delete() { modo = 'delete'; return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      order(campo: string, opts: { ascending: boolean }) { ordenes.push({ campo, asc: opts.ascending }); return self; },
      limit(n: number) { limite = n; return self; },
      single() { single = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };

    return self;
  }

  return { from: (nombre: string) => builder(nombre) } as unknown as SupabaseClient;
}

function conClienteFake(fn: (estado: Estado) => Promise<void>) {
  const estado: Estado = { journal: [], ideas: [] };
  setClienteSupabaseJournal(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabaseJournal(null));
}

function entrada(over: Partial<EntradaJournal> = {}): Fila {
  return {
    id: randomUUID(),
    created_at: '2026-08-23T10:00:00Z',
    fecha: '2026-08-23',
    tipo: 'dia',
    titulo: null,
    contenido: 'Texto',
    tags: [],
    fuente: 'os',
    proyecto: null,
    publicable: false,
    brain_slug: null,
    ...over,
  };
}

// --- CRUD --------------------------------------------------------------------

test('crearEntrada exige contenido', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearEntrada({ contenido: '   ' }), /contenido requerido/);
  });
});

test('crearEntrada guarda tipo, proyecto, tags normalizados y fuente', async () => {
  await conClienteFake(async (estado) => {
    const e = await crearEntrada({
      contenido: 'Porte notas a TanStack',
      tipo: 'proceso',
      proyecto: 'braintech',
      tags: ['OS', ' Contenido '],
      fuente: 'hermes',
      titulo: 'Port de notas',
    });
    assert.equal(e.tipo, 'proceso');
    assert.equal(e.proyecto, 'braintech');
    assert.deepEqual(e.tags, ['os', 'contenido']);
    assert.equal(e.fuente, 'hermes');
    assert.equal(e.titulo, 'Port de notas');
    assert.equal(estado.journal.length, 1);
  });
});

test('crearEntrada rechaza tipo, fuente y fecha invalidos', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => crearEntrada({ contenido: 'x', tipo: 'reflexion' }), /tipo invalido/);
    await assert.rejects(() => crearEntrada({ contenido: 'x', fuente: 'telegram' }), /fuente invalida/);
    await assert.rejects(() => crearEntrada({ contenido: 'x', fecha: '23-08-2026' }), /fecha invalida/);
  });
});

test('listarEntradas ordena por fecha descendente y filtra por fecha y tipo', async () => {
  await conClienteFake(async (estado) => {
    estado.journal.push(
      entrada({ fecha: '2026-08-21', contenido: 'Viejo' }),
      entrada({ fecha: '2026-08-23', contenido: 'Nuevo' }),
      entrada({ fecha: '2026-08-23', tipo: 'win', contenido: 'Gane' }),
    );

    const todas = await listarEntradas();
    assert.equal(todas.length, 3);
    assert.equal(todas[0]!.fecha, '2026-08-23');

    const delDia = await listarEntradas({ fecha: '2026-08-23' });
    assert.equal(delDia.length, 2);

    const wins = await listarEntradas({ tipo: 'win' });
    assert.equal(wins.length, 1);
    assert.equal(wins[0]!.contenido, 'Gane');

    const limitada = await listarEntradas({ limit: 1 });
    assert.equal(limitada.length, 1);
  });
});

test('listarEntradas valida los filtros', async () => {
  await conClienteFake(async () => {
    await assert.rejects(() => listarEntradas({ fecha: 'ayer' }), /fecha invalida/);
    await assert.rejects(() => listarEntradas({ tipo: 'reflexion' }), /tipo invalido/);
  });
});

test('actualizarEntrada cambia publicable y exige algun campo', async () => {
  await conClienteFake(async (estado) => {
    const fila = entrada();
    estado.journal.push(fila);
    const e = await actualizarEntrada(fila.id as string, { publicable: true });
    assert.equal(e.publicable, true);
    await assert.rejects(() => actualizarEntrada(fila.id as string, {}), /sin campos para actualizar/);
    await assert.rejects(() => actualizarEntrada(null, { publicable: true }), /id requerido/);
  });
});

test('eliminarEntrada borra la fila', async () => {
  await conClienteFake(async (estado) => {
    const fila = entrada();
    estado.journal.push(fila);
    await eliminarEntrada(fila.id as string);
    assert.equal(estado.journal.length, 0);
  });
});

// --- Puente a contenido -------------------------------------------------------

test('promoverAContenido crea una idea que apunta de vuelta a la entrada y la marca publicable', async () => {
  await conClienteFake(async (estado) => {
    const fila = entrada({ titulo: 'Como porte el OS', contenido: 'Detalle largo del port', tipo: 'proceso' });
    estado.journal.push(fila);

    const { entrada: actualizada, idea } = await promoverAContenido(fila.id as string);
    assert.equal(actualizada.publicable, true);
    assert.equal(estado.ideas.length, 1);
    assert.equal(idea.titulo, 'Como porte el OS');
    assert.equal(estado.ideas[0]!.status, 'idea');
    assert.match(String(estado.ideas[0]!.idea_madre), new RegExp(`journal:${fila.id}`));
  });
});

test('promoverAContenido usa la primera linea del contenido si no hay titulo', async () => {
  await conClienteFake(async (estado) => {
    const fila = entrada({ titulo: null, contenido: 'Primera linea\nsegunda linea' });
    estado.journal.push(fila);
    const { idea } = await promoverAContenido(fila.id as string);
    assert.equal(idea.titulo, 'Primera linea');
  });
});

// --- Brain -------------------------------------------------------------------

test('slugDelDia arma diario-YYYY-MM-DD y rechaza fechas invalidas', () => {
  assert.equal(slugDelDia('2026-08-23'), 'diario-2026-08-23');
  assert.throws(() => slugDelDia('23/08/2026'), /fecha invalida/);
});

test('componerMarkdownDia cumple las reglas del brain: wikilink y cierre Relacionado', () => {
  const md = componerMarkdownDia('2026-08-23', [
    entrada({ tipo: 'dia', contenido: 'Arranque el dia temprano' }) as unknown as EntradaJournal,
    entrada({ tipo: 'win', titulo: 'Deploy', contenido: 'Salio a produccion', tags: ['os'] }) as unknown as EntradaJournal,
  ]);
  assert.match(md, /^# Diario 2026-08-23/);
  assert.match(md, /\[\[pancho-os\]\]/);
  assert.match(md, /Relacionado: \[\[pancho-os\]\] \[\[hermes\]\]$/);
  assert.match(md, /## Win/);
  assert.match(md, /Salio a produccion/);
});

test('sincronizarDiaAlBrain escribe la pagina del dia y guarda el slug en las entradas', async () => {
  await conClienteFake(async (estado) => {
    estado.journal.push(
      entrada({ fecha: '2026-08-23', contenido: 'Entrada uno' }),
      entrada({ fecha: '2026-08-23', tipo: 'idea', contenido: 'Entrada dos' }),
      entrada({ fecha: '2026-08-22', contenido: 'Otro dia' }),
    );

    const escritas: Array<{ slug: string; tags: string[] }> = [];
    setEscritorBrain(async (pagina) => { escritas.push({ slug: pagina.slug, tags: pagina.tags }); });
    try {
      const resultado = await sincronizarDiaAlBrain('2026-08-23');
      assert.equal(resultado.slug, 'diario-2026-08-23');
      assert.equal(resultado.entradas, 2);
      assert.deepEqual(escritas[0]!.tags, ['os', 'personal']);
      assert.equal(estado.journal.filter((f) => f.brain_slug === 'diario-2026-08-23').length, 2);
      // El dia que no se sincronizo no debe quedar marcado.
      assert.equal(estado.journal.find((f) => f.fecha === '2026-08-22')!.brain_slug, null);
    } finally {
      setEscritorBrain(null);
    }
  });
});

test('sincronizarDiaAlBrain falla claro si el dia no tiene entradas', async () => {
  await conClienteFake(async () => {
    setEscritorBrain(async () => {});
    try {
      await assert.rejects(() => sincronizarDiaAlBrain('2026-08-23'), /no hay entradas/);
    } finally {
      setEscritorBrain(null);
    }
  });
});
