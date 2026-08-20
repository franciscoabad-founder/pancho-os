import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateLocalQueries,
  suggestedFormatsForIntent,
  suggestedPlatformsForIntent,
  normalizeQuery,
  deduplicateQueries,
  classifyIntent,
  scoreOpportunity,
  runRadar,
} from './index.ts';
import type { RadarQuery } from './types.ts';

test('generator: produces Spanish variations with modifiers', () => {
  const queries = generateLocalQueries({ seed: 'marketing digital' });
  assert.ok(queries.includes('que marketing digital'));
  assert.ok(queries.includes('como marketing digital'));
  assert.ok(queries.includes('por que marketing digital'));
  assert.ok(queries.includes('Ecuador marketing digital'));
  assert.ok(queries.includes('marketing digital Ecuador'));
  assert.ok(queries.includes('marketing digital'));
});

test('generator: includes custom country when provided', () => {
  const queries = generateLocalQueries({ seed: 'emprendimiento', country: 'Mexico' });
  assert.ok(queries.includes('Mexico emprendimiento'));
  assert.ok(queries.includes('emprendimiento Mexico'));
});

test('normalizer: lowercase, strip accents and punctuation, collapse spaces', () => {
  assert.equal(normalizeQuery('  ¿Cómo  Crear   Contenido?  '), 'como crear contenido');
  assert.equal(normalizeQuery('Café'), 'cafe');
});

test('deduplicate: removes duplicates preserving original', () => {
  const items: RadarQuery[] = [
    { query: 'Como crear contenido', source: 'local', original: 'Como crear contenido' },
    { query: 'cómo crear contenido', source: 'google', original: 'cómo crear contenido' },
    { query: 'como crear contenido', source: 'bing', original: 'como crear contenido' },
  ];
  const deduped = deduplicateQueries(items);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].original, 'Como crear contenido');
  assert.equal(deduped[0].source, 'local');
});

test('intent: classifies learning queries', () => {
  assert.equal(classifyIntent('que es marketing digital'), 'aprender');
  assert.equal(classifyIntent('como funciona el SEO'), 'aprender');
});

test('intent: classifies solving queries', () => {
  assert.equal(classifyIntent('como solucionar errores de SEO'), 'resolver');
  assert.equal(classifyIntent('herramienta para arreglar contenido'), 'resolver');
});

test('intent: classifies comparison queries', () => {
  assert.equal(classifyIntent('marketing digital versus redes sociales'), 'comparar');
  assert.equal(classifyIntent('mejor herramienta de contenido'), 'comparar');
});

test('intent: classifies buying queries', () => {
  assert.equal(classifyIntent('precio de curso de marketing'), 'comprar');
  assert.equal(classifyIntent('cuanto cuesta contratar un experto'), 'comprar');
});

test('intent: classifies risk queries', () => {
  assert.equal(classifyIntent('riesgos de comprar seguidores'), 'evaluar-riesgos');
  assert.equal(classifyIntent('estafa en cursos online'), 'evaluar-riesgos');
});

test('intent: classifies example queries', () => {
  assert.equal(classifyIntent('ejemplos de contenido viral'), 'buscar-ejemplos');
  assert.equal(classifyIntent('casos de exito en marketing'), 'buscar-ejemplos');
});

test('intent: classifies controversy queries', () => {
  assert.equal(classifyIntent('opinion sobre influencers'), 'opinion-controversia');
  assert.equal(classifyIntent('controversia en redes sociales'), 'opinion-controversia');
});

test('score: produces a value between 0 and 1 with explanation', () => {
  const { score, breakdown } = scoreOpportunity({
    query: 'que es marketing digital',
    seed: 'marketing digital',
    intent: 'aprender',
    source: 'local',
    clusterSize: 5,
    totalQueries: 20,
  });
  assert.ok(score >= 0 && score <= 1);
  assert.equal(breakdown.explanation.length, 5);
  assert.ok(breakdown.explanation[0].includes('Senal'));
  assert.ok(breakdown.explanation[1].includes('Relevancia'));
  assert.ok(breakdown.explanation[2].includes('Autoridad'));
  assert.ok(breakdown.explanation[3].includes('repurposing'));
  assert.ok(breakdown.explanation[4].includes('Saturacion'));
});

test('score: higher relevance yields higher score', () => {
  const high = scoreOpportunity({
    query: 'marketing digital',
    seed: 'marketing digital',
    intent: 'aprender',
    source: 'local',
    clusterSize: 1,
    totalQueries: 10,
  });
  const low = scoreOpportunity({
    query: 'como hacer pasteles',
    seed: 'marketing digital',
    intent: 'aprender',
    source: 'local',
    clusterSize: 1,
    totalQueries: 10,
  });
  assert.ok(high.score > low.score);
});

test('suggestedFormatsForIntent maps intent to formats', () => {
  assert.deepEqual(suggestedFormatsForIntent('aprender'), ['carrusel', 'guia']);
  assert.deepEqual(suggestedFormatsForIntent('resolver'), ['tutorial', 'video']);
  assert.deepEqual(suggestedFormatsForIntent('comprar'), ['caso-estudio', 'landing']);
});

test('suggestedPlatformsForIntent maps intent to platforms', () => {
  assert.ok(suggestedPlatformsForIntent('aprender').includes('LinkedIn'));
  assert.ok(suggestedPlatformsForIntent('resolver').includes('YouTube'));
});

test('runRadar: local-only mode returns opportunities sorted by score', async () => {
  const result = await runRadar({ seed: 'marketing digital', sources: ['local'] });
  assert.ok(result.opportunities.length > 0);
  assert.ok(result.sourcesUsed.includes('local'));
  assert.deepEqual(result.warnings, []);
  for (let i = 1; i < result.opportunities.length; i++) {
    assert.ok(result.opportunities[i - 1].opportunityScore >= result.opportunities[i].opportunityScore);
  }
});

test('runRadar: deduplicates across local variations', async () => {
  const result = await runRadar({ seed: 'SEO' });
  const normalized = result.opportunities.map((o) => normalizeQuery(o.query));
  const unique = new Set(normalized);
  assert.equal(unique.size, normalized.length);
});

test('runRadar: every opportunity has intent, cluster, score and suggestions', async () => {
  const result = await runRadar({ seed: 'contenido' });
  for (const opp of result.opportunities) {
    assert.ok(opp.intent);
    assert.ok(opp.cluster);
    assert.ok(typeof opp.opportunityScore === 'number');
    assert.ok(Array.isArray(opp.suggestedFormats));
    assert.ok(Array.isArray(opp.suggestedPlatforms));
  }
});

test('runRadar: empty seed returns empty result', async () => {
  const result = await runRadar({ seed: '   ' });
  assert.equal(result.opportunities.length, 0);
});
