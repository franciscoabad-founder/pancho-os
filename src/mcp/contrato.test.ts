// Tests de contrato: toToolRequest debe construir requests que los endpoints
// destino realmente aceptan. Cada caso de aqui nacio de un desajuste real
// encontrado en la auditoria del 15 ago 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toToolRequest, gfitDiaHoy, gfitConsultarProgreso, isoWeekdayHoyGuayaquil } from './osTools.ts';

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

test('agenda_actualizar_evento solo envia campos suministrados', () => {
  const req = toToolRequest('agenda_actualizar_evento', { evento_id: 'evt-1', etiquetas: ['ventas'] });
  assert.equal(req.path, '/api/agenda?id=evt-1');
  assert.equal(req.method, 'PATCH');
  assert.deepEqual(req.body, { etiquetas: ['ventas'] });
});

test('agenda_sincronizar_google conserva el rango solicitado', () => {
  const req = toToolRequest('agenda_sincronizar_google', { fecha_inicio: '2026-08-29', fecha_fin: '2026-09-11' });
  assert.equal(req.path, '/api/agenda/sync?desde=2026-08-29&hasta=2026-09-11');
  assert.equal(req.method, 'POST');
});

test('semana_diseno apunta a /api/semana (no a /api/priority-stack) y pasa semana_inicio como query semana', () => {
  const sinFecha = toToolRequest('semana_diseno', {});
  assert.equal(sinFecha.method, 'GET');
  assert.equal(sinFecha.path, '/api/semana');

  const conFecha = toToolRequest('semana_diseno', { semana_inicio: '2026-08-17' });
  assert.equal(conFecha.path, '/api/semana?semana=2026-08-17');
});

test('journal_log exige contenido y fija fuente hermes', () => {
  const req = toToolRequest('journal_log', { contenido: 'Porte el modulo de diario', tipo: 'proceso', proyecto: 'os' });
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/api/journal');
  assert.equal(req.body?.contenido, 'Porte el modulo de diario');
  assert.equal(req.body?.tipo, 'proceso');
  // La fuente NO se toma del agente: siempre queda como hermes.
  assert.equal(req.body?.fuente, 'hermes');
  assert.throws(() => toToolRequest('journal_log', { contenido: '   ' }), /contenido requerido/);
});

test('journal_listar arma el GET con los filtros que el endpoint acepta', () => {
  assert.equal(toToolRequest('journal_listar', {}).path, '/api/journal');
  const req = toToolRequest('journal_listar', { fecha: '2026-08-23', tipo: 'win', limit: 10 });
  assert.equal(req.method, 'GET');
  assert.equal(req.path, '/api/journal?fecha=2026-08-23&tipo=win&limit=10');
  assert.equal(req.body, undefined);
});

test('os_api_request permite el modulo journal', () => {
  assert.equal(toToolRequest('os_api_request', { module: 'journal', method: 'GET' }).path, '/api/journal');
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

test('ayuno_iniciar pasa inicio retroactivo y ayuno_terminar cierra el abierto sin id', () => {
  const inicio = toToolRequest('ayuno_iniciar', { inicio: '2026-08-15T14:00:00-05:00', protocolo: '16_8' });
  assert.equal(inicio.method, 'POST');
  assert.equal(inicio.path, '/api/salud/ayunos');
  assert.equal(inicio.body?.inicio, '2026-08-15T14:00:00-05:00');

  const fin = toToolRequest('ayuno_terminar', { fin: '2026-08-15T18:00:00-05:00' });
  assert.equal(fin.method, 'PATCH');
  assert.equal(fin.path, '/api/salud/ayunos');
  assert.equal(fin.body?.fin, '2026-08-15T18:00:00-05:00');

  const ahora = toToolRequest('ayuno_terminar', {});
  assert.equal(typeof ahora.body?.fin, 'string');
});

test('gfit_registrar_serie arma el POST a sesion-series con sesion_id y ejercicio_id', () => {
  const req = toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: 'e1', tipo: 'working', peso_kg: 80, reps: 8 });
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/api/gfit/sesion-series');
  assert.equal(req.body?.sesion_id, 's1');
  assert.equal(req.body?.ejercicio_id, 'e1');
  assert.equal(req.body?.peso_kg, 80);
  assert.equal(req.body?.reps, 8);
});

test('gfit_registrar_serie exige sesion_id y ejercicio_id', () => {
  assert.throws(() => toToolRequest('gfit_registrar_serie', { ejercicio_id: 'e1' }), /sesion_id/);
  assert.throws(() => toToolRequest('gfit_registrar_serie', { sesion_id: 's1' }), /ejercicio_id/);
});

test('gfit_registrar_serie rechaza sesion_id o ejercicio_id de solo espacios, no solo ausentes', () => {
  assert.throws(() => toToolRequest('gfit_registrar_serie', { sesion_id: '   ', ejercicio_id: 'e1' }), /sesion_id/);
  assert.throws(() => toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: '   ' }), /ejercicio_id/);
});

test('gfit_registrar_serie recorta espacios de sesion_id y ejercicio_id validos', () => {
  const req = toToolRequest('gfit_registrar_serie', { sesion_id: ' s1 ', ejercicio_id: ' e1 ', reps: 5 });
  assert.equal(req.body?.sesion_id, 's1');
  assert.equal(req.body?.ejercicio_id, 'e1');
});

test('gfit_registrar_serie acepta peso alternativo con unidad en vez de peso_kg', () => {
  const req = toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: 'e1', peso: 176, unidad: 'lb' });
  assert.equal(req.body?.peso, 176);
  assert.equal(req.body?.unidad, 'lb');
  // req.body.peso_kg SI es una clave presente (con valor undefined) -- lo que
  // de verdad protege a resolverPesoKg (sesion-series.ts, chequea 'peso_kg' in
  // body) es que JSON.stringify la descarta en executeOsTool. Verificar eso,
  // no solo el valor, para no dejar pasar una regresion si algun dia se manda
  // el body sin pasar por JSON.stringify primero.
  assert.equal('peso_kg' in JSON.parse(JSON.stringify(req.body)), false);
});

test('gfit_registrar_serie exige al menos una medicion (peso_kg, peso, reps o duracion_s)', () => {
  assert.throws(
    () => toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: 'e1' }),
    /al menos una medicion/,
  );
  // Cualquiera de las 4 alcanza.
  assert.doesNotThrow(() => toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: 'e1', reps: 8 }));
  assert.doesNotThrow(() => toToolRequest('gfit_registrar_serie', { sesion_id: 's1', ejercicio_id: 'e1', duracion_s: 30 }));
});

test('gfit_dia_hoy resuelve la rutina activa, encuentra el dia de hoy y usa los ejercicios ya anidados sin un tercer fetch', async (t) => {
  const llamadas: string[] = [];
  const weekdayHoy = isoWeekdayHoyGuayaquil();
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    llamadas.push(url);
    if (url.includes('/api/gfit/rutinas')) {
      return new Response(JSON.stringify({ rutinas: [{ id: 'rut-1', estado: 'activa' }] }), { status: 200 });
    }
    if (url.includes('/api/gfit/dias')) {
      return new Response(JSON.stringify({
        dias: [{ id: 'dia-1', weekday: weekdayHoy, nombre: 'Empuje', gfit_dia_ejercicios: [{ id: 'de-1', ejercicio_id: 'ej-1' }] }],
      }), { status: 200 });
    }
    throw new Error(`fetch no esperado en el test: ${url}`);
  });

  const resultado = await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), {});
  assert.equal((resultado.dia as { id: string }).id, 'dia-1');
  // gfit_dia_ejercicios no debe quedar tambien anidado en dia: se movio a
  // dia_ejercicios para no duplicar la lista de ejercicios en el payload.
  assert.equal('gfit_dia_ejercicios' in (resultado.dia as object), false);
  assert.deepEqual(resultado.dia_ejercicios, [{ id: 'de-1', ejercicio_id: 'ej-1' }]);
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/rutinas')), true);
  assert.equal(llamadas.some((u) => u.includes('rutina_id=rut-1')), true);
  // Un solo GET a /api/gfit/dias, ningun round-trip extra a /api/gfit/dia-ejercicios.
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/dia-ejercicios')), false);
  assert.equal(llamadas.length, 2);
});

test('gfit_dia_hoy no miente "no hay entreno hoy" en una rutina tipo orden (weekday null)', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/gfit/rutinas')) {
      return new Response(JSON.stringify({ rutinas: [{ id: 'rut-orden', estado: 'activa' }] }), { status: 200 });
    }
    if (url.includes('/api/gfit/dias')) {
      // Rutina secuencial: dias con tipo 'orden', weekday siempre null.
      return new Response(JSON.stringify({
        dias: [
          { id: 'dia-1', tipo: 'orden', weekday: null, orden: 1 },
          { id: 'dia-2', tipo: 'orden', weekday: null, orden: 2 },
        ],
      }), { status: 200 });
    }
    throw new Error(`fetch no esperado en el test: ${url}`);
  });

  const resultado = await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), {});
  assert.equal(resultado.dia, null);
  // No debe decir "no tiene un dia programado para hoy" (falso: si tiene dias,
  // solo que no estan indexados por dia de la semana).
  assert.doesNotMatch(String(resultado.mensaje), /no tiene un dia programado/);
  assert.match(String(resultado.mensaje), /secuencial|orden/);
});

test('gfit_dia_hoy dice "la rutina consultada" (no "activa") cuando el caller pasa rutina_id explicito', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/gfit/dias')) {
      return new Response(JSON.stringify({ dias: [{ id: 'dia-1', tipo: 'weekday', weekday: 99 }] }), { status: 200 });
    }
    throw new Error(`fetch no esperado en el test: ${url}`);
  });

  const resultado = await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), { rutina_id: 'rut-explicita' });
  assert.match(String(resultado.mensaje), /rutina consultada/);
  assert.doesNotMatch(String(resultado.mensaje), /rutina activa/);
});

test('gfit_dia_hoy usa rutina_id explicito sin consultar la rutina activa', async (t) => {
  const llamadas: string[] = [];
  const weekdayHoy = isoWeekdayHoyGuayaquil();
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    llamadas.push(url);
    if (url.includes('/api/gfit/dias')) {
      return new Response(JSON.stringify({ dias: [{ id: 'dia-2', weekday: weekdayHoy, gfit_dia_ejercicios: [] }] }), { status: 200 });
    }
    throw new Error(`fetch no esperado en el test: ${url}`);
  });

  await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), { rutina_id: 'rut-explicita' });
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/rutinas')), false);
  assert.equal(llamadas.some((u) => u.includes('rutina_id=rut-explicita')), true);
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/dia-ejercicios')), false);
});

test('gfit_dia_hoy responde sin reventar cuando no hay rutina activa ni dia programado para hoy', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/gfit/rutinas')) return new Response(JSON.stringify({ rutinas: [] }), { status: 200 });
    throw new Error(`fetch no esperado en el test: ${url}`);
  });
  const sinRutina = await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), {});
  assert.equal(sinRutina.dia, null);

  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    if (url.includes('/api/gfit/dias')) return new Response(JSON.stringify({ dias: [] }), { status: 200 });
    throw new Error(`fetch no esperado en el test: ${url}`);
  });
  const sinDiaHoy = await gfitDiaHoy(new Request('https://os.example.com/api/mcp'), new Headers(), { rutina_id: 'rut-1' });
  assert.equal(sinDiaHoy.dia, null);
});

test('gfit_consultar_progreso combina progreso y logros en un solo resultado', async (t) => {
  const llamadas: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: unknown) => {
    const url = String(input);
    llamadas.push(url);
    if (url.includes('/api/gfit/progreso')) {
      return new Response(JSON.stringify({ calendario: [], volumen: {}, tiempo: {}, breakdown3m: [], unoRm: [], recovery: [] }), { status: 200 });
    }
    if (url.includes('/api/gfit/logros')) {
      return new Response(JSON.stringify({ logros: [{ slug: 'primera-sesion', obtenidos: [] }] }), { status: 200 });
    }
    throw new Error(`fetch no esperado en el test: ${url}`);
  });

  const resultado = await gfitConsultarProgreso(new Request('https://os.example.com/api/mcp'), new Headers());
  assert.ok(resultado.progreso);
  assert.deepEqual(resultado.logros, [{ slug: 'primera-sesion', obtenidos: [] }]);
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/progreso')), true);
  assert.equal(llamadas.some((u) => u.includes('/api/gfit/logros')), true);
});

test('esTokenValido acepta el maestro y las keys con nombre, y rechaza lo demas', async () => {
  const { esTokenValido } = await import('../lib/osTokens.ts');
  const lista = 'kimi:tok-kimi,grok:tok-grok';
  assert.equal(esTokenValido('maestro', 'maestro', lista), true);
  assert.equal(esTokenValido('tok-kimi', 'maestro', lista), true);
  assert.equal(esTokenValido('tok-grok', 'maestro', lista), true);
  assert.equal(esTokenValido('kimi', 'maestro', lista), false);
  assert.equal(esTokenValido('otro', 'maestro', lista), false);
  assert.equal(esTokenValido('', 'maestro', lista), false);
  assert.equal(esTokenValido('tok-kimi', 'maestro', undefined), false);
});

test('finanzas_log_gasto conserva el body historico cuando no se pasa moneda', () => {
  const req = toToolRequest('finanzas_log_gasto', { monto: 25, categoria: 'comida', descripcion: 'almuerzo' });
  assert.equal(req.method, 'POST');
  assert.equal(req.path, '/api/gastos');
  assert.deepEqual(req.body, { monto: 25, categoria: 'comida', descripcion: 'almuerzo' });
  // Sin moneda explicita el handler asume USD: la clave ni siquiera viaja.
  assert.equal('moneda' in (req.body as object), false);
});

test('finanzas_log_gasto pasa la moneda normalizada a ISO en mayusculas', () => {
  const req = toToolRequest('finanzas_log_gasto', { monto: 370, categoria: 'comida', moneda: ' mxn ' });
  assert.equal(req.body?.moneda, 'MXN');
});

test('finanzas_log_gasto ignora una moneda vacia en vez de mandar basura', () => {
  const req = toToolRequest('finanzas_log_gasto', { monto: 10, categoria: 'x', moneda: '   ' });
  assert.equal('moneda' in (req.body as object), false);
});

test('finanzas_listar_gastos sigue siendo un GET plano a /api/gastos', () => {
  const req = toToolRequest('finanzas_listar_gastos', {});
  assert.equal(req.method, 'GET');
  assert.equal(req.path, '/api/gastos');
});
