// Tests de contrato: toToolRequest debe construir requests que los endpoints
// destino realmente aceptan. Cada caso de aqui nacio de un desajuste real
// encontrado en la auditoria del 15 ago 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toToolRequest } from '../pages/api/mcp.ts';

test('tareas_create mapea prioridad espanol a los valores que la API guarda', () => {
  const req = toToolRequest('tareas_create', { titulo: 'x', prioridad: 'alta' });
  assert.equal(req.body?.prioridad, 'high');
  assert.equal(toToolRequest('tareas_create', { titulo: 'x', prioridad: 'baja' }).body?.prioridad, 'low');
});

test('tareas_update mapea prioridad y arma PATCH con id en query', () => {
  const req = toToolRequest('tareas_update', { id: 'abc', estado: 'hecho', prioridad: 'critica' });
  assert.equal(req.method, 'PATCH');
  assert.equal(req.path, '/api/tareas?id=abc');
  assert.equal(req.body?.prioridad, 'critical');
  assert.equal(req.body?.estado, 'hecho');
});

test('nutricion_buscar_alimentos acepta alias del termino y nunca busca vacio', () => {
  for (const key of ['consulta', 'query', 'q', 'texto']) {
    const req = toToolRequest('nutricion_buscar_alimentos', { [key]: 'huevo' });
    assert.equal(req.path, '/api/salud/alimentos?q=huevo');
  }
  assert.throws(() => toToolRequest('nutricion_buscar_alimentos', {}), /Falta el termino/);
});

test('agenda_create_evento fija offset de Guayaquil en los timestamps', () => {
  const req = toToolRequest('agenda_create_evento', { titulo: 'r', fecha: '2026-08-20', hora_inicio: '09:00', hora_fin: '10:00' });
  assert.equal(req.body?.fecha, '2026-08-20T09:00:00-05:00');
  assert.equal(req.body?.fin, '2026-08-20T10:00:00-05:00');
});

test('os_api_request nunca manda body en GET o DELETE', () => {
  const req = toToolRequest('os_api_request', { module: 'tareas', method: 'GET', body: { x: 1 } });
  assert.equal(req.body, undefined);
});

test('os_api_request permite salud/sueno (la ruta real, no salud/sueno/index)', () => {
  const req = toToolRequest('os_api_request', { module: 'salud/sueno', method: 'GET' });
  assert.equal(req.path, '/api/salud/sueno');
  assert.throws(() => toToolRequest('os_api_request', { module: 'salud/sueno/index', method: 'GET' }), /no permitido/);
});
