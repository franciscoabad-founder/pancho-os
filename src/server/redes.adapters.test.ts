import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptadoresRedes, obtenerAdaptadorRed, PLATAFORMAS_REDES } from './redes.adapters.ts';

test('publica un adaptador seguro por plataforma y no inventa datos sin token', async () => {
  assert.deepEqual(adaptadoresRedes.map((a) => a.plataforma), PLATAFORMAS_REDES);
  const instagram = obtenerAdaptadorRed('instagram');
  assert.ok(instagram);
  assert.deepEqual(await instagram.recolectar('2026-01-01', '2026-01-02'), []);
});

test('plataforma desconocida no se resuelve', () => assert.equal(obtenerAdaptadorRed('desconocida'), undefined));
