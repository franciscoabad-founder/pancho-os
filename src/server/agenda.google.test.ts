import assert from 'node:assert/strict';
import test from 'node:test';
import { googleDateTime, googleEventBody, googleEventPayload } from './agenda.google.ts';

test('Google Calendar conserva el offset de Guayaquil', () => {
  assert.equal(googleDateTime('2026-08-29T09:00'), '2026-08-29T09:00:00-05:00');
  assert.equal(googleDateTime('2026-08-29T09:00:00Z'), '2026-08-29T09:00:00Z');
});

test('tags viajan entre Pancho OS y extendedProperties de Google', () => {
  const payload = googleEventPayload({ titulo: 'Bloque', fecha: '2026-08-29T09:00:00-05:00', etiquetas: ['ventas', 'foco'] });
  assert.deepEqual(payload.extendedProperties, { private: { pancho_os_tags: 'ventas,foco' } });
  const body = googleEventBody({ summary: 'Bloque', start: { dateTime: '2026-08-29T09:00:00-05:00' }, extendedProperties: { private: { pancho_os_tags: 'ventas, foco,ventas' } } });
  assert.deepEqual(body.etiquetas, ['ventas', 'foco']);
});

test('los eventos de todo el dia se importan como medianoche de Ecuador', () => {
  const body = googleEventBody({ summary: 'Cumpleaños', start: { date: '2026-09-01' }, end: { date: '2026-09-02' } });
  assert.equal(body.fecha, '2026-09-01T00:00:00-05:00');
  assert.equal(body.fin, '2026-09-02T00:00:00-05:00');
});
