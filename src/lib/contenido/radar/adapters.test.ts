// Integration tests for source adapters and the merged pipeline.
// All network access is mocked via globalThis.fetch; tests never hit the internet.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { googleAdapter } from './sources/google.ts';
import { bingAdapter } from './sources/bing.ts';
import { youtubeAdapter } from './sources/youtube.ts';
import { describeSources } from './sources/index.ts';
import { mergeQueries, runRadar, scoreOpportunity } from './index.ts';
import type { RawRadarQuery } from './types.ts';

const ENV_VARS = ['SERPAPI_API_KEY', 'YOUTUBE_API_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  for (const v of ENV_VARS) {
    savedEnv[v] = process.env[v];
    delete process.env[v];
  }
});

afterEach(() => {
  for (const v of ENV_VARS) {
    if (savedEnv[v] === undefined) delete process.env[v];
    else process.env[v] = savedEnv[v];
  }
  globalThis.fetch = realFetch;
});

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push(String(url));
    return handler(String(url), init);
  }) as typeof fetch;
  return calls;
}

function jsonResponse(data: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const INPUT = { seed: 'inteligencia artificial', lang: 'es', country: 'Ecuador', timeoutMs: 1000 };

// --- Sin credencial ---

test('adapter google sin credencial: disabled, sin fetch', async () => {
  const calls = mockFetchOnce(() => jsonResponse({}));
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'disabled');
  assert.equal(res.queries.length, 0);
  assert.equal(calls.length, 0);
});

test('adapter youtube sin credencial: disabled, sin fetch', async () => {
  const calls = mockFetchOnce(() => jsonResponse({}));
  const res = await youtubeAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'disabled');
  assert.equal(calls.length, 0);
});

// --- Respuesta realista ---

test('google con mock 200: parsea suggestions como autocomplete-suggestion', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  const calls = mockFetchOnce(() =>
    jsonResponse({
      suggestions: [
        { value: 'inteligencia artificial ecuador', relevance: 1 },
        { value: 'inteligencia artificial para empresas' },
        { value: 42 },
        { value: '  ' },
      ],
    }),
  );
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'ok');
  assert.equal(res.queries.length, 2);
  assert.equal(res.queries[0].query, 'inteligencia artificial ecuador');
  assert.equal(res.queries[0].signalType, 'autocomplete-suggestion');
  assert.equal(res.queries[0].observed, true);
  assert.ok(res.queries[0].capturedAt);
  assert.equal(res.queries[0].locale, 'es-EC');
  assert.match(calls[0], /engine=google_autocomplete/);
  assert.match(calls[0], /gl=ec/);
  assert.match(calls[0], /hl=es/);
});

test('bing con mock 200: parsea related_searches como related-search-query', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  const calls = mockFetchOnce(() =>
    jsonResponse({
      related_searches: [{ query: 'que es la inteligencia artificial' }, { query: 'ia ejemplos' }],
    }),
  );
  const res = await bingAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'ok');
  assert.equal(res.queries.length, 2);
  assert.equal(res.queries[0].signalType, 'related-search-query');
  assert.match(calls[0], /engine=bing/);
});

test('youtube con mock 200: parsea titulos como related-video-topic', async () => {
  process.env.YOUTUBE_API_KEY = 'yt-key-456';
  const calls = mockFetchOnce(() =>
    jsonResponse({
      items: [
        { snippet: { title: 'Qué es la IA &amp; cómo usarla' } },
        { snippet: { title: 'Agentes de IA en 2026' } },
      ],
    }),
  );
  const res = await youtubeAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'ok');
  assert.equal(res.queries.length, 2);
  assert.equal(res.queries[0].query, 'Qué es la IA & cómo usarla');
  assert.equal(res.queries[0].signalType, 'related-video-topic');
  assert.match(calls[0], /googleapis\.com\/youtube\/v3\/search/);
  assert.match(calls[0], /regionCode=EC/);
});

test('adapter con respuesta sin resultados: status empty', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  mockFetchOnce(() => jsonResponse({ suggestions: [] }));
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'empty');
  assert.equal(res.queries.length, 0);
});

// --- Errores ---

test('adapter con timeout: error clasificado como timeout', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  globalThis.fetch = ((url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted', 'AbortError')),
      );
    })) as typeof fetch;
  const res = await googleAdapter.fetchSuggestions({ ...INPUT, timeoutMs: 50 });
  assert.equal(res.status, 'error');
  assert.match(res.error ?? '', /timeout/i);
});

test('adapter con HTTP 401: error sanitizado sin credencial', async () => {
  process.env.SERPAPI_API_KEY = 'super-secret-key-789';
  mockFetchOnce(() => jsonResponse({ error: 'Invalid API key' }, 401));
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'error');
  assert.match(res.error ?? '', /401/);
  assert.ok(!res.error!.includes('super-secret-key-789'), 'el error no debe filtrar la API key');
  assert.ok(!res.error!.includes('api_key'), 'el error no debe incluir la URL con la key');
});

test('adapter youtube con HTTP 403 quotaExceeded: error clasificado', async () => {
  process.env.YOUTUBE_API_KEY = 'yt-key-456';
  mockFetchOnce(() =>
    jsonResponse(
      { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } },
      403,
    ),
  );
  const res = await youtubeAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'error');
  assert.match(res.error ?? '', /403/);
  assert.match(res.error ?? '', /quotaExceeded/);
});

test('adapter con HTTP 429: rate limit clasificado', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  mockFetchOnce(() => jsonResponse({}, 429));
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'error');
  assert.match(res.error ?? '', /429/);
  assert.match(res.error ?? '', /limite/i);
});

test('adapter con respuesta malformada: error controlado', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  globalThis.fetch = (async () =>
    new Response('<html>not json</html>', { status: 200 })) as typeof fetch;
  const res = await googleAdapter.fetchSuggestions(INPUT);
  assert.equal(res.status, 'error');
  assert.match(res.error ?? '', /JSON/);
});

// --- describeSources ---

test('describeSources: sanitizado, sin valores de credenciales', () => {
  process.env.SERPAPI_API_KEY = 'super-secret-key-789';
  const sources = describeSources();
  const google = sources.find((s) => s.id === 'google');
  const youtube = sources.find((s) => s.id === 'youtube');
  const local = sources.find((s) => s.id === 'local');
  assert.equal(google?.configured, true);
  assert.equal(youtube?.configured, false);
  assert.equal(youtube?.status, 'disabled');
  assert.ok(youtube?.setupInstructions);
  assert.equal(local?.configured, true);
  const serialized = JSON.stringify(sources);
  assert.ok(!serialized.includes('super-secret-key-789'));
});

// --- Merge con trazabilidad ---

function raw(query: string, source: RawRadarQuery['source'], observed: boolean): RawRadarQuery {
  return {
    query,
    original: query,
    source,
    signalType: observed ? 'autocomplete-suggestion' : 'generated',
    observed,
    capturedAt: '2026-08-20T00:00:00.000Z',
  };
}

test('merge: misma query en google y youtube conserva ambas fuentes', () => {
  const merged = mergeQueries([
    raw('como usar ia en una empresa', 'google', true),
    raw('Como usar IA en una empresa', 'youtube', true),
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources, ['google', 'youtube']);
  assert.deepEqual(merged[0].observedSources, ['google', 'youtube']);
  assert.equal(merged[0].observed, true);
  assert.equal(merged[0].generated, false);
});

test('merge: query observada y tambien generada localmente', () => {
  const merged = mergeQueries([
    raw('como usar ia', 'local', false),
    raw('como usar ia', 'google', true),
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources, ['local', 'google']);
  assert.deepEqual(merged[0].observedSources, ['google']);
  assert.equal(merged[0].observed, true);
  assert.equal(merged[0].generated, true);
});

// --- Pipeline con fuentes ---

test('runRadar: fuente sin credencial aparece disabled en sourceStatuses', async () => {
  const result = await runRadar({ seed: 'agentes de ia', sources: ['local', 'google'] });
  const google = result.sourceStatuses.find((s) => s.id === 'google');
  assert.equal(google?.status, 'disabled');
  assert.match(google?.reason ?? '', /SERPAPI_API_KEY/);
  assert.deepEqual(result.sourcesUsed, ['local']);
  assert.equal(result.warnings.length, 0);
  assert.ok(result.opportunities.every((o) => o.sourceType === 'generated'));
  assert.ok(result.generatedAt);
});

test('runRadar: fuente externa con mock aporta oportunidades observadas', async () => {
  process.env.SERPAPI_API_KEY = 'test-key-123';
  mockFetchOnce(() =>
    jsonResponse({ suggestions: [{ value: 'agentes de ia para ventas' }, { value: 'agentes de ia ecuador' }] }),
  );
  const result = await runRadar({ seed: 'agentes de ia', sources: ['local', 'google'] });
  const google = result.sourceStatuses.find((s) => s.id === 'google');
  assert.equal(google?.status, 'ok');
  assert.equal(google?.resultCount, 2);
  assert.ok(result.sourcesUsed.includes('google'));
  const observed = result.opportunities.filter((o) => o.observed);
  assert.ok(observed.length >= 2);
  assert.ok(observed.every((o) => o.sourceType === 'observed' || o.sourceType === 'mixed'));
});

test('runRadar: error de fuente no rompe el radar y se reporta', async () => {
  process.env.YOUTUBE_API_KEY = 'yt-key-456';
  mockFetchOnce(() => jsonResponse({}, 500));
  const result = await runRadar({ seed: 'transformacion digital', sources: ['local', 'youtube'] });
  const yt = result.sourceStatuses.find((s) => s.id === 'youtube');
  assert.equal(yt?.status, 'error');
  assert.ok(result.warnings.some((w) => w.includes('YouTube')));
  assert.ok(result.opportunities.length > 0); // el generador local sigue funcionando
});

// --- Score con y sin volumen ---

const SCORE_BASE = {
  query: 'que es marketing digital',
  seed: 'marketing digital',
  intent: 'aprender' as const,
  source: 'local',
  clusterSize: 1,
  totalQueries: 10,
};

test('score sin volumen: explica que es senal cualitativa', () => {
  const { breakdown } = scoreOpportunity({ ...SCORE_BASE, observedSources: ['google'] });
  assert.match(breakdown.explanation[0], /cualitativa|sin datos de volumen/i);
});

test('score con volumen real: observada sube y se atribuye la fuente', () => {
  const sinVolumen = scoreOpportunity({ ...SCORE_BASE, observedSources: ['google'] });
  const conVolumen = scoreOpportunity({
    ...SCORE_BASE,
    observedSources: ['google'],
    volume: 1200,
    volumeSource: 'keyword-planner',
    volumePeriod: '2026-07',
    volumeUnit: 'busquedas/mes',
  });
  assert.ok(conVolumen.breakdown.observedSignal > sinVolumen.breakdown.observedSignal);
  assert.match(conVolumen.breakdown.explanation[0], /volumen real 1200 busquedas\/mes segun keyword-planner/);
});

test('score: observada en fuente externa supera a solo-generada', () => {
  const generada = scoreOpportunity({ ...SCORE_BASE, observedSources: [] });
  const observada = scoreOpportunity({ ...SCORE_BASE, observedSources: ['bing'] });
  assert.ok(observada.score > generada.score);
});
