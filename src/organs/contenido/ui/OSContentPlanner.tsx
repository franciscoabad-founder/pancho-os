import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  FieldInput,
  FieldSelect,
  Spinner,
  ToastProvider,
  useToast,
} from '../../../os/components/ui';
import { nextStages } from '../domain/stages.ts';
import { STORY_STAGES, type StoryStage } from '../domain/types.ts';

interface Sprint {
  id: string;
  name: string;
  week_of: string;
  capacity: number;
  focus: string | null;
  campaign_id: string | null;
  status: string;
}

interface StoryRow {
  id: string;
  name: string;
  signal_id: string | null;
  sprint_id: string | null;
  parent_story_id: string | null;
  channel: string | null;
  format: string | null;
  stage: StoryStage;
  publish_date: string | null;
  promise: string | null;
  next_action: string | null;
}

interface SignalRow {
  id: string;
  name: string;
  exact_words: string;
  source: string | null;
  strength: number | null;
  status: string;
}

interface ResultRow {
  id: string;
  name: string;
  verdict: string | null;
  repurpose_queue: string | null;
  primary_kpi: string | null;
  kpi_result: number | null;
}

interface DeskData {
  weekOf: string;
  sprint: Sprint | null;
  stories: StoryRow[];
  weeklyValidation: { ok: boolean; violations: { code: string; message: string }[] };
  capacity: number;
  plannedPieces: number;
  capacityRemaining: number;
  lateStoryIds: string[];
  strongSignals: SignalRow[];
  reuseQueue: ResultRow[];
}

const STAGE_LABEL: Record<string, string> = {
  brief: 'Brief',
  shaping: 'Dando forma',
  ready: 'Lista',
  scheduled: 'Agendada',
  live: 'Publicada',
};

const VERDICT_LABEL: Record<string, string> = {
  reuse: 'Reusar',
  refine: 'Ajustar',
  retire: 'Retirar',
};

const tagStyle: React.CSSProperties = {
  fontFamily: 'var(--os-font-display)',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontSize: 10,
};

function OSContentPlannerInner() {
  const toast = useToast();
  const [desk, setDesk] = useState<DeskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signalWords, setSignalWords] = useState('');
  const [signalStrength, setSignalStrength] = useState('4');
  const [resultStoryId, setResultStoryId] = useState<string | null>(null);
  const [resultVerdict, setResultVerdict] = useState('reuse');
  const [resultKpi, setResultKpi] = useState('');
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string }[]>([]);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [focusInput, setFocusInput] = useState('');
  const [capacityInput, setCapacityInput] = useState('3');
  const [assetStoryId, setAssetStoryId] = useState<string | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetRights, setAssetRights] = useState('unknown');
  const syncedSprintId = useRef<string | null>(null);

  const loadDesk = useCallback(async () => {
    try {
      const res = await fetch('/api/os/contenido/planner/desk');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setDesk(data);
      // Solo sincroniza los inputs cuando cambia el sprint: recargar el Desk
      // tras cada mutacion no debe borrar lo que el usuario esta escribiendo.
      if (data.sprint && syncedSprintId.current !== data.sprint.id) {
        syncedSprintId.current = data.sprint.id;
        setFocusInput(data.sprint.focus ?? '');
        setCapacityInput(String(data.sprint.capacity ?? 3));
      }
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/os/contenido/planner/campaigns');
      const data = await res.json();
      if (res.ok) setCampaigns(data.rows ?? []);
    } catch {
      // Campañas son opcionales en el Desk; no bloquean la pantalla.
    }
  }, []);

  useEffect(() => {
    loadDesk();
    loadCampaigns();
  }, [loadDesk, loadCampaigns]);

  async function api(entity: string, method: string, body?: unknown, id?: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/os/contenido/planner/${entity}${id ? `?id=${id}` : ''}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.violations?.map((v: { message: string }) => v.message).join(' ');
        throw new Error(detail ? `${data.error}: ${detail}` : data.error || String(res.status));
      }
      await loadDesk();
      return true;
    } catch (err) {
      toast.show('Error: ' + (err instanceof Error ? err.message : String(err)), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createSprint() {
    if (!desk) return;
    const ok = await api('sprints', 'POST', {
      name: `Semana del ${desk.weekOf}`,
      week_of: desk.weekOf,
      capacity: 3,
      status: 'active',
    });
    if (ok) toast.show('Semana creada', 'ok');
  }

  async function saveSprintMeta(patch: Record<string, unknown>) {
    if (!desk?.sprint) return;
    const ok = await api('sprints', 'PATCH', patch, desk.sprint.id);
    if (ok) toast.show('Semana actualizada', 'ok');
  }

  async function createCampaign() {
    const name = newCampaignName.trim();
    if (!name) {
      toast.show('Nombre de campana requerido', 'error');
      return;
    }
    const ok = await api('campaigns', 'POST', { name, status: 'active' });
    if (ok) {
      setNewCampaignName('');
      await loadCampaigns();
      toast.show('Campana creada', 'ok');
    }
  }

  async function attachAsset(story: StoryRow) {
    if (!assetName.trim()) {
      toast.show('Nombre de la prueba requerido', 'error');
      return;
    }
    const ok = await api('assets', 'POST', {
      name: assetName.trim(),
      file_or_url: assetUrl.trim() || null,
      rights_status: assetRights,
      story_id: story.id,
      captured_on: new Date().toISOString().slice(0, 10),
    });
    if (ok) {
      setAssetStoryId(null);
      setAssetName('');
      setAssetUrl('');
      setAssetRights('unknown');
      toast.show('Prueba adjuntada', 'ok');
    }
  }

  async function captureSignal() {
    const words = signalWords.trim();
    if (!words) {
      toast.show('Escribe la frase exacta que oiste', 'error');
      return;
    }
    const ok = await api('signals', 'POST', {
      name: words.slice(0, 60),
      exact_words: words,
      strength: Number(signalStrength),
      status: 'new',
      captured_on: new Date().toISOString().slice(0, 10),
    });
    if (ok) {
      setSignalWords('');
      toast.show('Senal capturada', 'ok');
    }
  }

  async function shapeSignal(signal: SignalRow) {
    if (!desk?.sprint) {
      toast.show('Primero crea la semana', 'error');
      return;
    }
    const ok = await api('stories', 'POST', {
      name: signal.name,
      signal_id: signal.id,
      sprint_id: desk.sprint.id,
      stage: 'brief',
    });
    if (ok) toast.show('Historia padre creada en el sprint', 'ok');
  }

  async function addCut(story: StoryRow) {
    if (!desk?.sprint) return;
    const ok = await api('stories', 'POST', {
      name: `${story.name} (corte)`,
      parent_story_id: story.id,
      sprint_id: desk.sprint.id,
      stage: 'brief',
    });
    if (ok) toast.show('Corte anadido', 'ok');
  }

  async function moveStage(story: StoryRow, to: StoryStage) {
    const ok = await api('stories', 'PATCH', { stage: to }, story.id);
    if (ok) toast.show(`Historia movida a ${STAGE_LABEL[to]}`, 'ok');
  }

  async function saveResult(story: StoryRow) {
    const ok = await api('results', 'POST', {
      name: `Resultado: ${story.name}`,
      story_id: story.id,
      verdict: resultVerdict,
      kpi_result: resultKpi.trim() ? Number(resultKpi) : null,
      published_on: new Date().toISOString().slice(0, 10),
    });
    if (ok) {
      setResultStoryId(null);
      setResultKpi('');
      toast.show('Resultado registrado', 'ok');
    }
  }

  const storiesByStage = useMemo(() => {
    const map = new Map<StoryStage, StoryRow[]>();
    for (const stage of STORY_STAGES) map.set(stage, []);
    for (const s of desk?.stories ?? []) map.get(s.stage)?.push(s);
    return map;
  }, [desk]);

  const lateSet = useMemo(() => new Set(desk?.lateStoryIds ?? []), [desk]);

  if (loading) return <Spinner label="Cargando el Desk…" />;
  if (!desk) {
    return (
      <Card>
        <EmptyState icon="error" title="Sin datos" text="No se pudo cargar el planner." />
      </Card>
    );
  }

  return (
    <div>
      <Card padding="1.25rem" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p className="os-section-title" style={{ marginBottom: 4 }}>Semana actual ({desk.weekOf})</p>
            {desk.sprint ? (
              <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)', margin: 0 }}>
                {desk.sprint.name} · {desk.plannedPieces} de {desk.capacity} piezas comprometidas
              </p>
            ) : (
              <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>
                No hay sprint para esta semana.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {desk.sprint && (
              <div style={{ textAlign: 'center' }}>
                <span className="os-num" style={{ fontSize: 24, fontWeight: 700, color: desk.capacityRemaining > 0 ? 'var(--os-accent-light)' : 'var(--os-error)' }}>
                  {desk.capacityRemaining}
                </span>
                <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: 0 }}>capacidad restante</p>
              </div>
            )}
            {!desk.sprint && (
              <Button size="sm" onClick={createSprint} disabled={busy}>
                Crear semana (capacidad 3)
              </Button>
            )}
          </div>
        </div>
        {desk.weeklyValidation.violations.length > 0 && (
          <div style={{ marginTop: 10, padding: '0.6rem 0.8rem', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-error)', borderRadius: 8 }}>
            {desk.weeklyValidation.violations.map((v) => (
              <p key={v.code} style={{ fontSize: 12, color: 'var(--os-error)', margin: 0 }}>{v.message}</p>
            ))}
          </div>
        )}
        {desk.sprint && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <FieldInput
                label="Foco de la semana"
                placeholder="Tema central del sprint"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
              />
            </div>
            <div style={{ width: 110 }}>
              <FieldInput
                label="Capacidad"
                type="number"
                inputMode="numeric"
                placeholder="3"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
              />
            </div>
            <FieldSelect
              label="Campana"
              value={desk.sprint.campaign_id ?? ''}
              onChange={(e) => saveSprintMeta({ campaign_id: e.target.value || null })}
            >
              <option value="">Sin campana</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </FieldSelect>
            <Button
              size="sm"
              onClick={() => {
                const capacity = Number(capacityInput);
                saveSprintMeta({
                  focus: focusInput.trim() || null,
                  capacity: Number.isFinite(capacity) && capacity >= 0 ? Math.round(capacity) : 3,
                });
              }}
              disabled={busy}
            >
              Guardar
            </Button>
          </div>
        )}
        {desk.sprint && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <FieldInput
                label="Nueva campana"
                placeholder="Ej. Lanzamiento Kit IA"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={createCampaign} disabled={busy}>Crear campana</Button>
          </div>
        )}
        <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '10px 0 0' }}>
          Regla de la semana: una historia padre y maximo 3 piezas. La capacidad se calcula, no se edita a mano.
        </p>
      </Card>

      <Card padding="1.25rem" style={{ marginBottom: '1rem' }}>
        <p className="os-section-title" style={{ marginBottom: 8 }}>Escuchar: capturar senal</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <FieldInput
              label="Frase exacta de la audiencia"
              placeholder="Lo que alguien dijo, palabra por palabra"
              value={signalWords}
              onChange={(e) => setSignalWords(e.target.value)}
            />
          </div>
          <FieldSelect label="Fuerza" value={signalStrength} onChange={(e) => setSignalStrength(e.target.value)}>
            {['1', '2', '3', '4', '5'].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </FieldSelect>
          <Button size="sm" onClick={captureSignal} disabled={busy}>Capturar</Button>
        </div>
      </Card>

      <Card padding="1.25rem" style={{ marginBottom: '1rem' }}>
        <p className="os-section-title" style={{ marginBottom: 8 }}>Senales fuertes sin usar (fuerza 4-5)</p>
        {desk.strongSignals.length === 0 ? (
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>
            No hay senales fuertes pendientes. Captura una arriba o guarda oportunidades del Radar.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {desk.strongSignals.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '0.5rem 0.7rem', background: 'var(--os-fill-subtle)', borderRadius: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <span className="os-tag" style={{ ...tagStyle, color: 'var(--os-champagne)', marginRight: 8 }}>
                    fuerza {s.strength}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--os-text)' }}>{s.exact_words}</span>
                </div>
                <Button size="sm" variant="primary" onClick={() => shapeSignal(s)} disabled={busy || !desk.sprint}>
                  Dar forma
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="os-section-title" style={{ margin: '0 0 8px' }}>Tablero de la semana</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: '1rem' }}>
        {STORY_STAGES.map((stage) => (
          <div key={stage} style={{ background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', borderRadius: 10, padding: 10 }}>
            <p style={{ ...tagStyle, color: 'var(--os-muted)', margin: '0 0 8px' }}>
              {STAGE_LABEL[stage]} ({storiesByStage.get(stage)?.length ?? 0})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(storiesByStage.get(stage) ?? []).map((story) => {
                const isLateStory = lateSet.has(story.id);
                const moves = nextStages(story.stage);
                return (
                  <div key={story.id} style={{ background: 'var(--os-bg, transparent)', border: '1px solid var(--os-line)', borderRadius: 8, padding: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--os-text)', margin: '0 0 4px', lineHeight: 1.3 }}>
                      {story.name}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {story.parent_story_id === null ? (
                        <span className="os-tag" style={{ ...tagStyle, color: 'var(--os-accent-light)' }}>padre</span>
                      ) : (
                        <span className="os-tag" style={{ ...tagStyle, color: 'var(--os-muted)' }}>corte</span>
                      )}
                      {isLateStory && (
                        <span className="os-tag" style={{ ...tagStyle, color: 'var(--os-error)' }}>atrasada</span>
                      )}
                    </div>
                    {story.next_action && (
                      <p style={{ fontSize: 11, color: 'var(--os-muted)', margin: '0 0 6px' }}>
                        Proxima accion: {story.next_action}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {moves.map((to) => (
                        <button
                          key={to}
                          onClick={() => moveStage(story, to)}
                          disabled={busy}
                          style={{ background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 11, color: 'var(--os-text-2)', minHeight: 30 }}
                        >
                          {to === 'brief' || STORY_STAGES.indexOf(to) < STORY_STAGES.indexOf(story.stage)
                            ? `← ${STAGE_LABEL[to]}`
                            : `${STAGE_LABEL[to]} →`}
                        </button>
                      ))}
                      {story.parent_story_id === null && desk.sprint && (
                        <button
                          onClick={() => addCut(story)}
                          disabled={busy}
                          style={{ background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 11, color: 'var(--os-text-2)', minHeight: 30 }}
                        >
                          + corte
                        </button>
                      )}
                      {story.stage === 'live' && (
                        <button
                          aria-expanded={resultStoryId === story.id}
                          onClick={() => setResultStoryId(resultStoryId === story.id ? null : story.id)}
                          style={{ background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 11, color: 'var(--os-champagne)', minHeight: 30 }}
                        >
                          Registrar resultado
                        </button>
                      )}
                      <button
                        aria-expanded={assetStoryId === story.id}
                        onClick={() => setAssetStoryId(assetStoryId === story.id ? null : story.id)}
                        style={{ background: 'none', border: '1px solid var(--os-line)', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontSize: 11, color: 'var(--os-text-2)', minHeight: 30 }}
                      >
                        + prueba
                      </button>
                    </div>
                    {assetStoryId === story.id && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ minWidth: 140 }}>
                          <FieldInput label="Prueba / asset" placeholder="Captura, cita, grafico" value={assetName} onChange={(e) => setAssetName(e.target.value)} />
                        </div>
                        <div style={{ minWidth: 140 }}>
                          <FieldInput label="URL (opcional)" placeholder="https://…" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} />
                        </div>
                        <FieldSelect label="Derechos" value={assetRights} onChange={(e) => setAssetRights(e.target.value)}>
                          <option value="unknown">Sin revisar</option>
                          <option value="internal_reference_only">Solo referencia interna</option>
                          <option value="cleared">Autorizado</option>
                          <option value="restricted">Restringido</option>
                        </FieldSelect>
                        <Button size="sm" onClick={() => attachAsset(story)} disabled={busy}>Adjuntar</Button>
                      </div>
                    )}
                    {resultStoryId === story.id && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <FieldSelect label="Veredicto" value={resultVerdict} onChange={(e) => setResultVerdict(e.target.value)}>
                          <option value="reuse">Reusar</option>
                          <option value="refine">Ajustar</option>
                          <option value="retire">Retirar</option>
                        </FieldSelect>
                        <div style={{ width: 110 }}>
                          <FieldInput label="KPI (opcional)" type="number" inputMode="decimal" placeholder="0" value={resultKpi} onChange={(e) => setResultKpi(e.target.value)} />
                        </div>
                        <Button size="sm" onClick={() => saveResult(story)} disabled={busy}>Guardar</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Card padding="1.25rem">
        <p className="os-section-title" style={{ marginBottom: 8 }}>Aprender: cola de reuso</p>
        {desk.reuseQueue.length === 0 ? (
          <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0 }}>
            Nada para reusar todavia. Los resultados con veredicto Reusar aparecen aqui.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {desk.reuseQueue.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--os-text-2)', minWidth: 0 }}>
                <span className="os-tag" style={{ ...tagStyle, color: 'var(--os-accent-light)' }}>
                  {VERDICT_LABEL[r.verdict ?? ''] ?? 'Reusar'}
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                {r.kpi_result != null && (
                  <span style={{ color: 'var(--os-muted)' }}>KPI: {r.kpi_result}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function OSContentPlanner() {
  return (
    <ToastProvider>
      <OSContentPlannerInner />
    </ToastProvider>
  );
}
