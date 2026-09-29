import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparSesiones,
  arbolTelegram,
  normalizarMensaje,
  canalDeSource,
  contarPorCanal,
  filtrarSesiones,
  normalizarSesion,
  sourcesDeCanal,
  type SesionHermes,
} from './canalesHermes.ts';

const dm = {
  id: 's1', source: 'telegram', profile: 'default', title: 'Revisar ayer brain', chat_id: '1706227173',
  chat_type: 'dm', display_name: 'Xaxxo', thread_id: null, message_count: 247, last_active: 1790637502.6,
};
const topic = (thread: string, when: number) => ({
  id: `t${thread}`, source: 'telegram', profile: 'default', title: `Topic ${thread}`, chat_id: '-1004384794270',
  chat_type: 'group', display_name: 'Pancho HQ', thread_id: thread, message_count: 4, last_active: when,
});

test('canalDeSource: mapea los source reales de Hermes y manda lo demas a otro', () => {
  assert.equal(canalDeSource('telegram'), 'telegram');
  assert.equal(canalDeSource('api_server'), 'os');
  assert.equal(canalDeSource('desktop'), 'desktop');
  assert.equal(canalDeSource('cron'), 'cron');
  assert.equal(canalDeSource('bridge'), 'puente');
  assert.equal(canalDeSource('oneshot'), 'oneshot');
  assert.equal(canalDeSource('tool'), 'oneshot');
  assert.equal(canalDeSource('Telegram'), 'telegram');
  assert.equal(canalDeSource('whatsapp'), 'otro');
  assert.equal(canalDeSource(null), 'otro');
});

test('sourcesDeCanal: devuelve los source para pedirle a Hermes', () => {
  assert.deepEqual(sourcesDeCanal('oneshot'), ['oneshot', 'tool']);
  assert.deepEqual(sourcesDeCanal('otro'), []);
});

test('normalizarSesion: sin id se descarta', () => {
  assert.equal(normalizarSesion({ source: 'cron' }), null);
  assert.equal(normalizarSesion({ id: '  ' }), null);
});

test('normalizarSesion: DM de Telegram trae chat, tipo y sin topic', () => {
  const s = normalizarSesion(dm)!;
  assert.equal(s.canal, 'telegram');
  assert.equal(s.perfilEtiqueta, 'Alfred');
  assert.deepEqual(s.telegram, { chatId: '1706227173', tipo: 'dm', nombre: 'Xaxxo', topic: null });
  assert.equal(s.mensajes, 247);
});

test('normalizarSesion: grupo con topic conserva el thread_id como texto', () => {
  const s = normalizarSesion(topic('1279', 10))!;
  assert.equal(s.telegram?.tipo, 'group');
  assert.equal(s.telegram?.topic, '1279');
  assert.equal(s.telegram?.nombre, 'Pancho HQ');
});

test('normalizarSesion: sin titulo usa la vista previa y luego un texto fijo; canales no Telegram no traen grupo', () => {
  assert.equal(normalizarSesion({ id: 'a', source: 'cron', preview: 'Audita gateways' })!.titulo, 'Audita gateways');
  const vacia = normalizarSesion({ id: 'b', source: 'cron' })!;
  assert.equal(vacia.titulo, 'Sin titulo');
  assert.equal(vacia.telegram, null);
  assert.equal(vacia.perfil, 'default');
});

test('filtrarSesiones: por canal, por perfil y por texto sin importar acentos ni mayusculas', () => {
  const a = normalizarSesion(dm)!;
  const b = normalizarSesion({ id: 'c1', source: 'cron', profile: 'arazza', title: 'Reporte diario de ventas' })!;
  const c = normalizarSesion({ id: 'c2', source: 'bridge', profile: 'arazza', title: 'Consultar precio', preview: 'plan de almuerzos' })!;
  const todas = [a, b, c];
  assert.deepEqual(filtrarSesiones(todas, { canal: 'cron' }).map((s) => s.id), ['c1']);
  assert.deepEqual(filtrarSesiones(todas, { perfil: 'arazza' }).map((s) => s.id), ['c1', 'c2']);
  assert.deepEqual(filtrarSesiones(todas, { texto: 'ALMUERZOS' }).map((s) => s.id), ['c2']);
  assert.deepEqual(filtrarSesiones(todas, { texto: 'revisár' }).map((s) => s.id), ['s1']);
  assert.deepEqual(filtrarSesiones(todas, { texto: 'xaxxo' }).map((s) => s.id), ['s1']);
  assert.equal(filtrarSesiones(todas, {}).length, 3);
});

test('contarPorCanal: en orden del catalogo y sin canales vacios', () => {
  const s = ['cron', 'telegram', 'cron', 'bridge'].map((source, i) => normalizarSesion({ id: `x${i}`, source })!);
  assert.deepEqual(contarPorCanal(s), [
    { canal: 'telegram', total: 1 },
    { canal: 'cron', total: 2 },
    { canal: 'puente', total: 1 },
  ]);
});

test('normalizarMensaje: traduce roles, descarta vacios y conserva la herramienta', () => {
  assert.equal(normalizarMensaje({ id: 1, role: 'user', content: ' hola ', timestamp: 5 })!.texto, 'hola');
  assert.equal(normalizarMensaje({ id: 2, role: 'assistant', content: 'ok' })!.rol, 'agente');
  assert.equal(normalizarMensaje({ id: 3, role: 'assistant', content: '', tool_calls: [{}] }), null);
  assert.equal(normalizarMensaje({ role: 'user', content: 'sin id' }), null);
  const t = normalizarMensaje({ id: 4, role: 'tool', content: '{"ok":true}', tool_name: 'Cerebro' })!;
  assert.equal(t.rol, 'herramienta');
  assert.equal(t.herramienta, 'Cerebro');
});

test('arbolTelegram: chat -> topic -> sesiones, lo mas reciente primero, sin canales no Telegram', () => {
  const s = [
    normalizarSesion(topic('56', 100))!,
    normalizarSesion(topic('1279', 300))!,
    normalizarSesion({ ...topic('1279', 200), id: 'otra', profile: 'rafik' })!,
    normalizarSesion(dm)!,
    normalizarSesion({ id: 'k', source: 'cron' })!,
  ];
  const arbol = arbolTelegram(s);
  assert.deepEqual(arbol.map((c) => c.nombre), ['Xaxxo', 'Pancho HQ']);
  const hq = arbol.find((c) => c.chatId === '-1004384794270')!;
  assert.deepEqual(hq.topics.map((t) => t.etiqueta), ['Topic 1279', 'Topic 56']);
  assert.deepEqual(hq.topics[0].sesiones.map((x) => x.id), ['t1279', 'otra']);
  assert.equal(arbol.find((c) => c.tipo === 'dm')!.topics[0].etiqueta, 'Chat');
});

test('agruparSesiones: Telegram por grupo, resto por canal, fijadas primero y luego las recientes', () => {
  const sesiones: SesionHermes[] = [
    normalizarSesion(topic('56', 100))!,
    normalizarSesion(topic('1279', 300))!,
    normalizarSesion({ ...topic('1', 50), pinned: true })!,
    normalizarSesion(dm)!,
    normalizarSesion({ id: 'k1', source: 'cron', title: 'Watchdog' })!,
    normalizarSesion({ id: 'o1', source: 'api_server', title: 'Taski' })!,
  ];
  const grupos = agruparSesiones(sesiones);
  assert.deepEqual(grupos.map((g) => g.titulo), [
    'Telegram · Pancho HQ',
    'Telegram · Xaxxo',
    'Pancho OS',
    'Tareas programadas',
  ]);
  assert.deepEqual(grupos[0].sesiones.map((s) => s.telegram?.topic), ['1', '1279', '56']);
});
