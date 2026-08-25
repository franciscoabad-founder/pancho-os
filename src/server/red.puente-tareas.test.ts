// Contrato del puente red -> tareas. Verifica que solo genera tarea para
// vencidos, que usa la tactica del plan si existe, y que el RPC recibe los
// parametros correctos (la deduplicacion real vive en el RPC, no aca).

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generarTareasSemana, setClienteSupabaseRedPuente } from './red.puente-tareas.ts';

type Fila = Record<string, unknown>;

function crearClienteFake(estado: {
  personas: Fila[];
  planes: Fila[];
  objetivos: Fila[];
  rpcLlamadas: Array<{ nombre: string; args: unknown }>;
}): SupabaseClient {
  function builder(nombre: string) {
    const filtros: Array<(f: Fila) => boolean> = [];
    let maybeSingleMode = false;

    function filas(): Fila[] {
      if (nombre === 'os_red_personas') return estado.personas;
      if (nombre === 'os_red_planes') return estado.planes;
      if (nombre === 'os_red_objetivos') return estado.objetivos;
      return [];
    }

    async function ejecutar() {
      const resultado = filas().filter((f) => filtros.every((fn) => fn(f)));
      if (maybeSingleMode) return { data: resultado[0] ?? null, error: null };
      return { data: resultado, error: null };
    }

    const self = {
      select() { return self; },
      eq(campo: string, valor: unknown) { filtros.push((f) => f[campo] === valor); return self; },
      maybeSingle() { maybeSingleMode = true; return ejecutar(); },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return ejecutar().then(resolve, reject); },
    };
    return self;
  }

  return {
    from: (nombre: string) => builder(nombre),
    rpc: async (nombre: string, args: unknown) => {
      estado.rpcLlamadas.push({ nombre, args });
      const items = (args as { p_items: Array<{ titulo: string }> }).p_items;
      return {
        data: { captura_id: randomUUID(), items_detectados: items.length, items_creados: items.length, items_duplicados: 0 },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
}

function persona(over: Partial<Fila> = {}): Fila {
  return { id: randomUUID(), nombre: 'Ana', ultima_interaccion: null, frecuencia_dias: 30, activo: true, ...over };
}

function conClienteFake(fn: (estado: { personas: Fila[]; planes: Fila[]; objetivos: Fila[]; rpcLlamadas: Array<{ nombre: string; args: unknown }> }) => Promise<void>) {
  const estado = { personas: [] as Fila[], planes: [] as Fila[], objetivos: [] as Fila[], rpcLlamadas: [] as Array<{ nombre: string; args: unknown }> };
  setClienteSupabaseRedPuente(() => crearClienteFake(estado));
  return fn(estado).finally(() => setClienteSupabaseRedPuente(null));
}

const HOY = '2026-08-25';

test('generarTareasSemana: sin personas vencidas, no llama al RPC', async () => {
  await conClienteFake(async (estado) => {
    estado.personas.push(persona({ ultima_interaccion: '2026-08-24', frecuencia_dias: 30 }));
    const r = await generarTareasSemana('2026-W35', HOY);
    assert.equal(r.items_detectados, 0);
    assert.equal(estado.rpcLlamadas.length, 0);
  });
});

test('generarTareasSemana: una persona vencida genera un item con fuente "red"', async () => {
  await conClienteFake(async (estado) => {
    estado.personas.push(persona({ nombre: 'Elena', ultima_interaccion: null, frecuencia_dias: 30 }));
    const r = await generarTareasSemana('2026-W35', HOY);
    assert.equal(r.items_detectados, 1);
    assert.equal(estado.rpcLlamadas.length, 1);
    assert.equal(estado.rpcLlamadas[0].nombre, 'capturar_lote');
    const args = estado.rpcLlamadas[0].args as { p_fuente: string; p_items: Array<{ titulo: string }> };
    assert.equal(args.p_fuente, 'red');
    assert.equal(args.p_items[0].titulo, 'Contactar a Elena');
  });
});

test('generarTareasSemana: usa la tactica del plan activo si existe', async () => {
  await conClienteFake(async (estado) => {
    const p = persona({ nombre: 'Elena' });
    estado.personas.push(p);
    const plan = { id: randomUUID(), activo: true };
    estado.planes.push(plan);
    estado.objetivos.push({ plan_id: plan.id, persona_id: p.id, tactica: 'Unirme a su celebracion' });

    await generarTareasSemana('2026-W35', HOY);
    const args = estado.rpcLlamadas[0].args as { p_items: Array<{ detalle: string | null }> };
    assert.equal(args.p_items[0].detalle, 'Unirme a su celebracion');
  });
});

test('generarTareasSemana: ignora personas inactivas', async () => {
  await conClienteFake(async (estado) => {
    estado.personas.push(persona({ activo: false }));
    const r = await generarTareasSemana('2026-W35', HOY);
    assert.equal(r.items_detectados, 0);
  });
});
