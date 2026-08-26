import assert from 'node:assert/strict';
import test from 'node:test';
import { mondayOf, sugerirTimeblocks } from './timeblocking.handlers.ts';

test('timeblocking calcula lunes y respeta eventos, off y presupuesto', () => {
    assert.equal(mondayOf('2026-08-26'), '2026-08-24');
    const slots = sugerirTimeblocks({ semana: '2026-08-24', dias: [{ dia: 1, modo: 'maker' }, { dia: 2, modo: 'off' }], eventos: [{ fecha: '2026-08-24T08:00:00-05:00', fin: '2026-08-24T10:00:00-05:00' }], presupuesto: [{ funcion: 'construir', horas_semana_objetivo: 2 }] });
    assert.deepEqual(slots, [{ fecha: '2026-08-24', hora_inicio: '10:00', hora_fin: '11:00', minutos: 60, funcion: 'construir', modo: 'maker' }, { fecha: '2026-08-24', hora_inicio: '11:00', hora_fin: '12:00', minutos: 60, funcion: 'construir', modo: 'maker' }]);
});
test('timeblocking rechaza ventana invertida', () => assert.throws(() => sugerirTimeblocks({ semana: '2026-08-24', dias: [], eventos: [], presupuesto: [], horaInicio: '18:00', horaFin: '08:00' })));
