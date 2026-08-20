import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  FieldInput,
  FieldSelect,
  Spinner,
  ToastProvider,
  useToast,
} from '../ui';

interface ScoreBreakdown {
  observedSignal: number;
  relevance: number;
  authority: number;
  repurposing: number;
  saturation: number;
  explanation: string[];
}

interface RadarOpportunity {
  query: string;
  original: string;
  source: string;
  sources: string[];
  observedSources: string[];
  signalTypes: string[];
  sourceType: 'observed' | 'generated' | 'mixed';
  observed: boolean;
  generated: boolean;
  intent: string;
  cluster: string;
  opportunityScore: number;
  scoreBreakdown: ScoreBreakdown;
  suggestedFormats: string[];
  suggestedPlatforms: string[];
  capturedAt: string;
  volume: number | null;
}

interface SourceStatus {
  id: string;
  label: string;
  configured: boolean;
  available: boolean;
  status: 'ready' | 'ok' | 'empty' | 'error' | 'disabled';
  resultCount: number;
  reason?: string;
  setupInstructions?: string;
  endpoint?: string;
}

interface RadarResponse {
  seed: string;
  opportunities: RadarOpportunity[];
  sourceStatuses: SourceStatus[];
  sourcesUsed: string[];
  warnings: string[];
  generatedAt: string;
}

const SOURCE_OPTIONS = [
  { value: 'local', label: 'Generador local' },
  { value: 'google', label: 'Google Autocomplete' },
  { value: 'bing', label: 'Bing Related Searches' },
  { value: 'youtube', label: 'YouTube Search' },
] as const;

const INTENT_LABEL: Record<string, string> = {
  aprender: 'Aprender',
  resolver: 'Resolver',
  comparar: 'Comparar',
  comprar: 'Comprar',
  'evaluar-riesgos': 'Evaluar riesgos',
  'buscar-ejemplos': 'Buscar ejemplos',
  'opinion-controversia': 'Opinion / controversia',
};

const INTENT_COLOR: Record<string, string> = {
  aprender: 'var(--os-accent-light)',
  resolver: 'var(--os-champagne)',
  comparar: 'var(--os-accent)',
  comprar: 'var(--os-champagne)',
  'evaluar-riesgos': 'var(--os-error)',
  'buscar-ejemplos': 'var(--os-accent-light)',
  'opinion-controversia': 'var(--os-muted)',
};

const SIGNAL_LABEL: Record<string, string> = {
  generated: 'generada localmente',
  'autocomplete-suggestion': 'sugerencia de autocompletado',
  'related-search-query': 'busqueda relacionada',
  'related-video-topic': 'tema de video relacionado',
};

function statusLine(s: SourceStatus): { text: string; color: string } {
  switch (s.status) {
    case 'ok':
      return { text: `conectada, ${s.resultCount} resultado(s)`, color: 'var(--os-success, #4ade80)' };
    case 'empty':
      return { text: 'conectada, sin resultados', color: 'var(--os-muted)' };
    case 'error':
      return { text: `error: ${s.reason ?? 'desconocido'}`, color: 'var(--os-error)' };
    case 'disabled':
      return { text: `no configurada (${s.reason ?? 'sin credencial'})`, color: 'var(--os-muted)' };
    case 'ready':
    default:
      return { text: 'configurada', color: 'var(--os-muted)' };
  }
}

function OSContentRadarInner() {
  const toast = useToast();
  const [seed, setSeed] = useState('');
  const [lang, setLang] = useState('es');
  const [country, setCountry] = useState('Ecuador');
  const [selectedSources, setSelectedSources] = useState<string[]>(['local']);
  const [configStatus, setConfigStatus] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadarResponse | null>(null);
  const [filterIntent, setFilterIntent] = useState('todos');
  const [filterSource, setFilterSource] = useState('todos');
  const [searchText, setSearchText] = useState('');
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/os/contenido/radar/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.sources)) setConfigStatus(data.sources);
      })
      .catch(() => {
        // Status is informational; the radar still works without it.
      });
  }, []);

  function configFor(id: string): SourceStatus | undefined {
    return configStatus.find((s) => s.id === id);
  }

  function toggleSource(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  }

  async function runRadar() {
    if (!seed.trim()) {
      toast.show('Escribe una palabra o tema semilla', 'error');
      return;
    }
    if (selectedSources.length === 0) {
      toast.show('Selecciona al menos una fuente', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/os/contenido/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seed.trim(),
          lang,
          country,
          sources: selectedSources,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setResult(data);
      setFilterIntent('todos');
      setFilterSource('todos');
      setSearchText('');
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function promote(opportunity: RadarOpportunity) {
    setPromotingId(opportunity.query);
    try {
      const res = await fetch('/api/os/contenido/radar/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      toast.show('Agregada al Content Planner', 'ok');
      if (data.warning) toast.show(data.warning, 'info');
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setPromotingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!result) return [];
    return result.opportunities.filter((opp) => {
      if (filterIntent !== 'todos' && opp.intent !== filterIntent) return false;
      if (filterSource !== 'todos' && !(opp.sources ?? [opp.source]).includes(filterSource)) return false;
      if (searchText && !opp.query.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [result, filterIntent, filterSource, searchText]);

  const intents = useMemo(() => {
    if (!result) return [];
    return Array.from(new Set(result.opportunities.map((o) => o.intent)));
  }, [result]);

  const sourcesInResult = useMemo(() => {
    if (!result) return [];
    const all = result.opportunities.flatMap((o) => o.sources ?? [o.source]);
    return Array.from(new Set(all));
  }, [result]);

  const onlyLocal = useMemo(() => {
    if (!result) return false;
    return result.opportunities.length > 0 && result.opportunities.every((o) => !o.observed);
  }, [result]);

  return (
    <div>
      <Card padding="1.25rem" style={{ marginBottom: '1rem' }}>
        <p className="os-section-title" style={{ marginBottom: '0.875rem' }}>
          Configurar radar
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <FieldInput
            label="Tema o palabra semilla"
            placeholder="marketing digital"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
          <FieldSelect label="Idioma" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="es">Espanol</option>
            <option value="en">Ingles</option>
          </FieldSelect>
          <FieldInput
            label="Pais o region"
            placeholder="Ecuador"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--os-muted)', marginBottom: 6 }}>
            Fuentes activas
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SOURCE_OPTIONS.map((s) => {
              const cfg = configFor(s.value);
              const unconfigured = s.value !== 'local' && cfg && !cfg.configured;
              const selected = selectedSources.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => toggleSource(s.value)}
                  title={unconfigured ? cfg.setupInstructions ?? cfg.reason : cfg?.endpoint}
                  className={selected ? 'os-pill os-pill-accent' : 'os-pill'}
                  style={{
                    cursor: 'pointer',
                    border: selected ? 'none' : '1px solid var(--os-line)',
                    background: selected ? undefined : 'transparent',
                    color: selected ? undefined : 'var(--os-muted)',
                    minHeight: 30,
                    opacity: unconfigured && !selected ? 0.6 : 1,
                  }}
                >
                  {s.label}
                  {unconfigured ? ' (sin credencial)' : ''}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', marginTop: 6 }}>
            El generador local siempre funciona. Las fuentes externas solo consultan datos reales si su credencial esta configurada; si no, se reportan como no configuradas.
          </p>
        </div>

        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={runRadar} disabled={loading}>
            {loading ? 'Analizando...' : 'Ejecutar radar'}
          </Button>
        </div>
      </Card>

      {loading && <Spinner label="Analizando oportunidades..." />}

      {result && !loading && (
        <div>
          <Card padding="0.875rem" style={{ marginBottom: '1rem' }}>
            <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 'var(--os-text-xs)', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--os-muted)', margin: '0 0 6px' }}>
              Fuentes de esta busqueda
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {result.sourceStatuses.map((s) => {
                const line = statusLine(s);
                return (
                  <li key={s.id} style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)' }}>
                    <strong>{s.label}:</strong>{' '}
                    <span style={{ color: line.color }}>{line.text}</span>
                  </li>
                );
              })}
            </ul>
            <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '8px 0 0' }}>
              Leyenda: <strong>observada</strong> = aparecio en una fuente externa; <strong>generada</strong> = la creo el generador local; <strong>multi-fuente</strong> = aparecio en varias fuentes.
            </p>
          </Card>

          {onlyLocal && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 0.875rem', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', borderRadius: 8 }}>
              <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
                Esta busqueda usa el generador local. No representa volumen ni consultas observadas en buscadores.
              </p>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 0.875rem', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', borderRadius: 8 }}>
              {result.warnings.map((w) => (
                <p key={w} style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
                  {w}
                </p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <FieldSelect label="Intencion" value={filterIntent} onChange={(e) => setFilterIntent(e.target.value)}>
              <option value="todos">Todas</option>
              {intents.map((i) => (
                <option key={i} value={i}>{INTENT_LABEL[i] ?? i}</option>
              ))}
            </FieldSelect>
            <FieldSelect label="Fuente" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="todos">Todas</option>
              {sourcesInResult.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FieldSelect>
            <div style={{ flex: 1, minWidth: 160 }}>
              <FieldInput
                label="Buscar"
                placeholder="Filtrar consultas..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', marginBottom: '0.75rem' }}>
            {filtered.length} oportunidades encontradas para <strong>{result.seed}</strong>
          </p>

          {filtered.length === 0 && (
            <Card>
              <EmptyState
                icon="search_off"
                title="Sin resultados"
                text="Prueba con otro tema o ajusta los filtros."
              />
            </Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((opp) => {
              const isExpanded = expandedScore.has(opp.query);
              const multiSource = (opp.sources ?? []).length > 1;
              return (
                <Card key={opp.query} padding="1rem">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span
                          className="os-tag"
                          style={{
                            fontFamily: 'var(--os-font-display)',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: opp.observed ? 'var(--os-success, #4ade80)' : 'var(--os-muted)',
                          }}
                        >
                          {opp.observed ? (opp.generated ? 'Observada + generada' : 'Observada') : 'Generada local'}
                        </span>
                        {multiSource && (
                          <span className="os-tag" style={{ fontFamily: 'var(--os-font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {opp.sources.length} fuentes
                          </span>
                        )}
                        <span
                          className="os-tag"
                          style={{
                            fontFamily: 'var(--os-font-display)',
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: INTENT_COLOR[opp.intent] ?? 'var(--os-muted)',
                          }}
                        >
                          {INTENT_LABEL[opp.intent] ?? opp.intent}
                        </span>
                        <span className="os-tag" style={{ fontFamily: 'var(--os-font-display)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {opp.cluster}
                        </span>
                      </div>
                      <h3 style={{ fontFamily: 'var(--os-font-display)', fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: '0 0 0.375rem', lineHeight: 1.3 }}>
                        {opp.query}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>
                        Fuentes: {(opp.sources ?? [opp.source]).join(', ')}
                        {opp.observedSources.length > 0 && ` (observada en: ${opp.observedSources.join(', ')})`}
                        {' — '}Senal: {opp.signalTypes.map((t) => SIGNAL_LABEL[t] ?? t).join(', ')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span className="os-num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--os-accent-light)' }}>
                        {(opp.opportunityScore * 100).toFixed(0)}
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => promote(opp)}
                        disabled={promotingId === opp.query}
                      >
                        {promotingId === opp.query ? 'Agregando...' : 'Agregar al Content Planner'}
                      </Button>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setExpandedScore((prev) => {
                          const s = new Set(prev);
                          if (s.has(opp.query)) s.delete(opp.query);
                          else s.add(opp.query);
                          return s;
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        color: 'var(--os-muted)',
                        fontSize: 12,
                        fontFamily: 'var(--os-font-display)',
                        fontWeight: 600,
                        minHeight: 30,
                      }}
                    >
                      {isExpanded ? 'Ocultar explicacion del score' : 'Ver explicacion del score'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 8, padding: '0.75rem 0.875rem', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', borderRadius: 8 }}>
                      <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '0 0 6px' }}>
                        {opp.volume != null
                          ? 'Este score incluye un dato de volumen real (ver primera linea).'
                          : 'Este score es una heuristica basada en senales locales y de presencia en fuentes, no en volumen de busqueda real.'}
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {opp.scoreBreakdown.explanation.map((line) => (
                          <li key={line} style={{ fontSize: 12, color: 'var(--os-text-2)', lineHeight: 1.4 }}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--os-muted)' }}>
                    <span>Formatos: {opp.suggestedFormats.join(', ')}</span>
                    <span>Plataformas: {opp.suggestedPlatforms.join(', ')}</span>
                    <span>Capturada: {new Date(opp.capturedAt).toLocaleString()}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {!result && !loading && (
        <Card>
          <EmptyState
            icon="radar"
            title="Content Radar"
            text="Descubre oportunidades de contenido a partir de una palabra semilla. Ejecuta el radar para ver resultados."
          />
        </Card>
      )}
    </div>
  );
}

export default function OSContentRadar() {
  return (
    <ToastProvider>
      <OSContentRadarInner />
    </ToastProvider>
  );
}
