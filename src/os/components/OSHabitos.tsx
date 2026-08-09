import { useEffect, useMemo, useState } from 'react';
import OSHabitoForm from './OSHabitoForm';
import { EmptyState, Spinner, useConfirm } from './ui';

// ── Tipos (contrato del API construido en paralelo) ─────────────────────────
export interface Racha { actual: number; mejor: number }
export interface Nivel { nivel: number; xpEnNivel: number; xpSiguiente: number; progreso: number }
export interface Perfil { xp_total: number; nivel: Nivel }
export interface Habito {
  id: string; nombre: string; descripcion: string | null;
  tipo: 'habito' | 'diaria'; dificultad: string; dias_semana: number[];
  intencion: string | null; hora_recordatorio: string | null;
  es_core: boolean; en_checklist: boolean; orden: number;
  estado: 'activo' | 'pausado' | 'archivado';
  valor: number;
  hecho_hoy: boolean | null;
  conteo_hoy: { mas: number; menos: number } | null;
  racha: Racha | null; ema: number | null; falloAyer: boolean; ultimos7: boolean[];
  // NOTA: no vienen listados explícitamente en el contrato del GET, pero la UI
  // los necesita para saber qué botones mostrar en hábitos +/-. Se asumen
  // presentes en la fila (mismas columnas que persiste el POST de creación).
  permite_mas?: boolean;
  permite_menos?: boolean;
}
interface CheckResponse {
  ok?: boolean; xp?: number; oro?: number; valor?: number;
  racha?: Racha; nivel?: Nivel; subioNivel?: boolean; error?: string;
}

const TZ = 'America/Guayaquil';
function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}
function isoWeekdayHoy(): number {
  // Deriva el día ISO de la fecha de hoy en America/Guayaquil (no del navegador),
  // consistente con diaIso() de lib/habitos/fechas.ts.
  const d = new Date(`${hoyISO()}T12:00:00`).getDay(); // 0=domingo..6=sabado
  return d === 0 ? 7 : d;
}
const DIA_LABEL: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };

// ── Anillo EMA mini (mismo patrón SVG, recoloreado a clay) ──────────────────
function AnilloEma({ valor, size = 30 }: { valor: number | null; size?: number }) {
  const r = (size - 6) / 2;
  const C = 2 * Math.PI * r;
  const pct = valor == null ? 0 : Math.max(0, Math.min(1, valor));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--m-line)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--m-accent)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${pct * C} ${C}`} style={{ transition: 'stroke-dasharray .4s' }} />
    </svg>
  );
}

export default function OSHabitos() {
  const { confirm, sheet } = useConfirm();
  const [habitos, setHabitos] = useState<Habito[]>([]);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formAbierto, setFormAbierto] = useState<'nuevo' | Habito | null>(null);
  const [mostrarOtras, setMostrarOtras] = useState(false);
  const [mostrarPausados, setMostrarPausados] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, { texto: string; ts: number }>>({});
  const [nivelUp, setNivelUp] = useState<number | null>(null);
  const [enviando, setEnviando] = useState<Set<string>>(new Set());

  async function cargar(mostrarLoading = true) {
    if (mostrarLoading) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/os/habitos');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHabitos(data.habitos ?? []);
      setPerfil(data.perfil ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  function mostrarFeedback(habitoId: string, xp?: number, oro?: number) {
    if (!xp && !oro) return;
    const partes = [xp ? `+${xp} XP` : null, oro ? `+${oro} ORO` : null].filter(Boolean);
    const ts = Date.now();
    setFeedback((cur) => ({ ...cur, [habitoId]: { texto: `${partes.join(' · ')} · ¡anotado!`, ts } }));
    setTimeout(() => {
      setFeedback((cur) => {
        if (cur[habitoId]?.ts !== ts) return cur;
        const next = { ...cur };
        delete next[habitoId];
        return next;
      });
    }, 2000);
  }
  function mostrarNivelUp(n: number) {
    setNivelUp(n);
    setTimeout(() => setNivelUp((cur) => (cur === n ? null : cur)), 2400);
  }

  async function registrarCheck(habitoId: string, signo?: 'mas' | 'menos') {
    if (enviando.has(habitoId)) return;
    setEnviando((cur) => new Set(cur).add(habitoId));
    setError('');
    try {
      const res = await fetch('/api/os/habitos/checks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signo ? { habito_id: habitoId, signo } : { habito_id: habitoId }),
      });
      const data: CheckResponse = await res.json();
      if (res.status === 409) { setError('Esta diaria ya fue registrada hoy.'); await cargar(false); return; }
      if (data.error) throw new Error(data.error);
      mostrarFeedback(habitoId, data.xp, data.oro);
      window.dispatchEvent(new CustomEvent('os:xp', { detail: { xp: data.xp, oro: data.oro } }));
      if (data.subioNivel && data.nivel) mostrarNivelUp(data.nivel.nivel);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar');
    } finally {
      setEnviando((cur) => {
        const next = new Set(cur);
        next.delete(habitoId);
        return next;
      });
    }
  }

  async function toggleDiaria(h: Habito) {
    if (enviando.has(h.id)) return;
    if (h.hecho_hoy) {
      if (!(await confirm({
        title: 'Deshacer check',
        text: 'Se quita el registro de hoy para este habito (XP y racha incluidos).',
        confirmLabel: 'Deshacer',
        danger: true,
      }))) return;
      setEnviando((cur) => new Set(cur).add(h.id));
      try {
        const res = await fetch(`/api/os/habitos/checks?habito_id=${h.id}&fecha=${hoyISO()}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('No se pudo deshacer');
        await cargar(false);
      } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
      finally {
        setEnviando((cur) => {
          const next = new Set(cur);
          next.delete(h.id);
          return next;
        });
      }
      return;
    }
    await registrarCheck(h.id);
  }

  async function reactivar(h: Habito) {
    try {
      await fetch(`/api/os/habitos?id=${h.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'activo' }),
      });
      await cargar(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al reactivar'); }
  }

  const hoyIso = isoWeekdayHoy();
  const activos = useMemo(() => habitos.filter((h) => h.estado === 'activo'), [habitos]);
  const pausados = useMemo(() => habitos.filter((h) => h.estado === 'pausado'), [habitos]);
  const diariasHoy = useMemo(
    () => activos.filter((h) => h.tipo === 'diaria' && h.dias_semana?.includes(hoyIso)),
    [activos, hoyIso],
  );
  const diariasOtras = useMemo(
    () => activos.filter((h) => h.tipo === 'diaria' && !h.dias_semana?.includes(hoyIso)),
    [activos, hoyIso],
  );
  const habitosMasMenos = useMemo(() => activos.filter((h) => h.tipo === 'habito'), [activos]);

  const alertaFalloAyer = useMemo(() => {
    const fallados = habitos.filter((h) => h.falloAyer);
    if (!fallados.length) return null;
    const extra = fallados.length > 1 ? ` y ${fallados.length - 1} más` : '';
    return `Ayer fallaste ${fallados[0].nombre}${extra}. Hoy no se falla dos veces.`;
  }, [habitos]);
  const hayRiesgo = useMemo(() => habitos.some((h) => h.falloAyer), [habitos]);

  // HUD de racha: la mejor racha activa entre los hábitos activos (loss aversion:
  // esto es lo primero que se ve, es lo que se pierde si se falla hoy).
  const mejorRacha = useMemo(() => {
    let mejor = 0;
    for (const h of activos) {
      if (h.racha && h.racha.actual > mejor) mejor = h.racha.actual;
    }
    return mejor;
  }, [activos]);

  const progresoPct = useMemo(() => {
    const p = perfil?.nivel.progreso ?? 0;
    const pct = p <= 1 ? p * 100 : p;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [perfil]);

  if (formAbierto) {
    return (
      <OSHabitoForm
        habito={formAbierto === 'nuevo' ? null : formAbierto}
        onCerrar={() => setFormAbierto(null)}
        onGuardado={() => { setFormAbierto(null); cargar(false); }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* HUD de racha: primero lo que se pierde (loss aversion) */}
      <div className="m-hud">
        <p className="m-hud-label">Racha activa · días</p>
        <p className={`m-hud-num${hayRiesgo ? ' is-riesgo' : ''}`}>{mejorRacha}</p>
        <div className="m-telemetria" style={{ marginTop: 10 }}>
          <span>Nivel {perfil?.nivel.nivel ?? 1}</span>
          <span>·</span>
          <strong>{perfil?.xp_total ?? 0} XP</strong>
          <span>·</span>
          <span>{perfil?.nivel.xpSiguiente ?? 0} para subir</span>
        </div>
        <div className="m-bar"><div className="m-bar-fill" style={{ width: `${progresoPct}%` }} /></div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--m-accent-text)', fontSize: 13, fontFamily: 'var(--m-font-rounded)' }}>
          <span>{error}</span>
          <button className="m-btn-ghost" onClick={() => cargar()}>Reintentar</button>
        </div>
      )}

      {alertaFalloAyer && (
        <div className="m-banda-alerta">
          <p>No se falla dos veces: {alertaFalloAyer}</p>
        </div>
      )}

      {loading ? (
        <Spinner label="Cargando hábitos..." />
      ) : habitos.length === 0 ? (
        <EmptyState
          title="Sin hábitos aún"
          text="Crea el primero o inicia un journey."
          action={
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="m-btn" onClick={() => setFormAbierto('nuevo')}>+ Crear primer hábito</button>
              <a href="/os/habitos/journeys" className="m-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Ver journeys</a>
            </div>
          }
        />
      ) : (
        <>
          {/* Diarias de hoy: lista de misiones */}
          <div>
            <p className="m-section-title">Diarias de hoy</p>
            {diariasHoy.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--m-muted)', fontFamily: 'var(--m-font-rounded)' }}>Nada programado para hoy.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {diariasHoy.map((h) => {
                  const hecho = !!h.hecho_hoy;
                  const enVuelo = enviando.has(h.id);
                  const fb = feedback[h.id];
                  return (
                    <div key={h.id} className="m-mission" style={{ flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleDiaria(h)}
                        disabled={enVuelo}
                        aria-label={hecho ? 'Deshacer' : 'Marcar hecho'}
                        className="m-checkbox"
                        style={{ opacity: enVuelo ? 0.5 : 1 }}
                      >
                        <span className={`m-checkbox-box${hecho ? ' is-checked' : ''}`}>{hecho ? 'X' : ''}</span>
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--m-fg)' }}>{h.nombre}</span>
                          {h.es_core && <span className="m-estado" style={{ color: 'var(--m-accent-text)' }}>Core</span>}
                        </div>
                        {h.intencion && <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>{h.intencion}</p>}
                        {fb && <p className="m-terminal-line is-flash">{fb.texto}</p>}
                      </div>
                      <span className={`m-estado${hecho ? ' is-ok' : ''}`}>{hecho ? 'Hecho' : 'Pendiente'}</span>
                      <AnilloEma valor={h.ema} size={30} />
                      <button className="m-btn-ghost" style={{ flexShrink: 0 }} onClick={() => setFormAbierto(h)} title="Editar" aria-label="Editar hábito">✎</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hábitos +/- */}
          <div>
            <p className="m-section-title">Hábitos</p>
            {habitosMasMenos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--m-muted)', fontFamily: 'var(--m-font-rounded)' }}>Sin hábitos +/- activos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {habitosMasMenos.map((h) => {
                  const contadores = h.conteo_hoy ?? { mas: 0, menos: 0 };
                  const permiteMas = h.permite_mas ?? true;
                  const permiteMenos = h.permite_menos ?? false;
                  const enVuelo = enviando.has(h.id);
                  const fb = feedback[h.id];
                  return (
                    <div key={h.id} className="m-mission" style={{ flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--m-fg)' }}>{h.nombre}</span>
                        </div>
                        {h.intencion && <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>{h.intencion}</p>}
                        {fb && <p className="m-terminal-line is-flash">{fb.texto}</p>}
                      </div>
                      <AnilloEma valor={h.ema} size={28} />
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                        {permiteMenos && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <button
                              className="m-glyph-btn is-menos"
                              style={{ opacity: enVuelo ? 0.5 : 1 }}
                              disabled={enVuelo}
                              onClick={() => registrarCheck(h.id, 'menos')}
                              aria-label="Registrar fallo/menos"
                            >−</button>
                            <span className="m-glyph-count">{contadores.menos}</span>
                          </div>
                        )}
                        {permiteMas && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <button
                              className="m-glyph-btn is-mas"
                              style={{ opacity: enVuelo ? 0.5 : 1 }}
                              disabled={enVuelo}
                              onClick={() => registrarCheck(h.id, 'mas')}
                              aria-label="Registrar hecho"
                            >+</button>
                            <span className="m-glyph-count">{contadores.mas}</span>
                          </div>
                        )}
                      </div>
                      <button className="m-btn-ghost" style={{ flexShrink: 0 }} onClick={() => setFormAbierto(h)} title="Editar" aria-label="Editar hábito">✎</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diarias de otros días (colapsado) */}
          {diariasOtras.length > 0 && (
            <div>
              <button className="m-btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setMostrarOtras(!mostrarOtras)}>
                {mostrarOtras ? '▾' : '▸'} Diarias de otros días ({diariasOtras.length})
              </button>
              {mostrarOtras && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {diariasOtras.map((h) => (
                    <div key={h.id} className="m-mission" style={{ justifyContent: 'space-between', padding: '8px 12px', opacity: 0.6 }}>
                      <span style={{ fontSize: 13, color: 'var(--m-fg)' }}>{h.nombre}</span>
                      <span className="m-estado">
                        {h.dias_semana.map((d) => DIA_LABEL[d]).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pausados */}
          {pausados.length > 0 && (
            <div>
              <button className="m-btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setMostrarPausados(!mostrarPausados)}>
                {mostrarPausados ? '▾' : '▸'} Pausados ({pausados.length})
              </button>
              {mostrarPausados && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {pausados.map((h) => (
                    <div key={h.id} className="m-mission" style={{ justifyContent: 'space-between', padding: '8px 12px', opacity: 0.6 }}>
                      <span style={{ fontSize: 13, color: 'var(--m-fg)' }}>{h.nombre}</span>
                      <button className="m-btn-ghost" onClick={() => reactivar(h)}>Reactivar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button className="m-btn" onClick={() => setFormAbierto('nuevo')}>+ Nuevo hábito</button>

      {/* Celebración de subida de nivel: tile clay flotante */}
      {nivelUp != null && (
        <div className="habito-levelup" style={{ position: 'fixed', left: '50%', top: '90px', zIndex: 190, pointerEvents: 'none' }}>
          <div style={{ background: 'var(--m-accent)', color: '#fff', fontFamily: 'var(--m-font-rounded)', fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 999, boxShadow: 'var(--m-shadow)', border: 'none', whiteSpace: 'nowrap' }}>
            ¡Subiste a nivel {nivelUp}! 🎉
          </div>
        </div>
      )}

      <style>{`
        @keyframes habito-levelup-pop {
          0%   { opacity: 0; transform: translate(-50%, -10px) scale(0.96); }
          12%  { opacity: 1; transform: translate(-50%, 0) scale(1); }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
        }
        .habito-levelup { animation: habito-levelup-pop 2.4s ease-out forwards; }
      `}</style>
      {sheet}
    </div>
  );
}
