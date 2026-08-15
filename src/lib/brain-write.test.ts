import assert from 'node:assert/strict';
import test from 'node:test';
import { bindBrainWriteToTenant, createDedupeKey, validateBrainWrite } from './brain-write.ts';

test('preserves the shared evidence, tag, and Brain-link gate', async () => {
  const write = bindBrainWriteToTenant('pancho', 'human', {
    target: 'brain', op: 'create', slug: 'tesis-personal', title: 'Tesis personal', body: 'Texto confirmado.',
    tags: ['personal'], wikilinks: [],
    evidence: { source: 'taski', source_ref: 'session-1/message-4', observed_at: '2026-08-15T12:00:00.000Z', confidence: 1 },
    dedupe_key: await createDedupeKey('pancho', 'Tesis personal', 'session-1/message-4'),
  });
  const result = validateBrainWrite(write);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('El contrato debio rechazar la pagina sin confirmacion ni wikilink');
  assert.match(result.issues.join(' '), /confidence 2/);
  assert.match(result.issues.join(' '), /wikilink/);
});
