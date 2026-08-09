import { useEffect, useMemo, useState } from 'react';
import { Spinner, useConfirm } from './ui';

// ── Tipos (contrato de los endpoints api/os/juego/*, construidos en paralelo) ──
interface Nivel { nivel: number; xpEnNivel: number; xpSiguiente: number; progreso: number }
interface Config { hp_activo: boolean; oro_activo: boolean; loot_activo: boolean }
interface Jugador { xp_total: number; oro: number; hp: number; hp_max: number; config: Config; nivel: Nivel }
interface EventosHoy { xp: number; oro: number; conteo: number }
interface ObjetivoQuest {
  tipo: 'evento' | 'habito';
  evento?: 'sesion_gym' | 'tarea_hecha' | 'comida_log' | 'ayuno_fin';
  habito_id?: string;
  meta: number;
}
interface ProgresoQuest { progreso: number; meta: number }
interface Quest {
  id: string; titulo: string; objetivo: ObjetivoQuest;
  apuesta_oro: number; premio_xp: number; premio_oro: number;
  semana_inicio: string; estado: 'activa' | 'ganada' | 'perdida' | 'cancelada';
  progreso?: ProgresoQuest;
}
interface Recompensa {
  id: string; nombre: string; descripcion: string | null; costo_oro: number;
  icono: string | null; veces_canjeada: number; estado: 'activa' | 'archivada';
}
interface HabitoOpcion { id: string; nombre: string }

const EVENTOS: Array<{ value: NonNullable<ObjetivoQuest['evento']>; label: string }> = [
  { value: 'sesion_gym', label: 'Sesiones de gym' },
  { value: 'tarea_hecha', label: 'Tareas hechas' },
  { value: 'comida_log', label: 'Comidas registradas' },
  { value: 'ayuno_fin', label: 'Ayunos completados' },
];

// ── Estilos compartidos (tokens --m-* del módulo, clay cálido) ──────────────
const card: React.CSSProperties = {
  background: 'var(--m-surface)', border: 'none', boxShadow: 'var(--m-shadow)', borderRadius: 20, padding: '1rem',
};

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="m-bar"><div className="m-bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
  );
}

function Switch({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`m-switch${on ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <span className="m-switch-knob" />
    </button>
  );
}

export default function OSJuego() {
  const { confirm, sheet } = useConfirm();
  const [jugador, setJugador] = useState<Jugador | null>(null);
  const [eventosHoy, setEventosHoy] = useState<EventosHoy | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [habitos, setHabitos] = useState<HabitoOpcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [guardandoConfig, setGuardandoConfig] = useState<keyof Config | null>(null);
  const [canjeando, setCanjeando] = useState<string | null>(null);
  const [feedbackTienda, setFeedbackTienda] = useState('');
  const [formRecompensaAbierto, setFormRecompensaAbierto] = useState(false);
  const [nombreR, setNombreR] = useState('');
  const [costoR, setCostoR] = useState('50');
  const [descR, setDescR] = useState('');
  const [enviandoR, setEnviandoR] = useState(false);

  const [formQuestAbierto, setFormQuestAbierto] = useState(false);
  const [tituloQ, setTituloQ] = useState('');
  const [tipoObjQ, setTipoObjQ] = useState<'evento' | 'habito'>('evento');
  const [eventoQ, setEventoQ] = useState<ObjetivoQuest['evento']>('sesion_gym');
  const [habitoIdQ, setHabitoIdQ] = useState('');
  const [metaQ, setMetaQ] = useState('3');
  const [apuestaQ, setApuestaQ] = useState('20');
  const [premioXpQ, setPremioXpQ] = useState('30');
  const [premioOroQ, setPremioOroQ] = useState('0');
  const [enviandoQ, setEnviandoQ] = useState(false);
  const [errorQ, setErrorQ] = useState('');
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  async function cargar(mostrarLoading = true) {
    if (mostrarLoading) setLoading(true);
    setError('');
    try {
      const [rEstado, rQuests, rRecompensas, rHabitos] = await Promise.all([
        fetch('/api/os/juego/estado'),
        fetch('/api/os/juego/quests'),
        fetch('/api/os/juego/recompensas'),
        fetch('/api/os/habitos'),
      ]);
      const dEstado = await rEstado.json();
      const dQuests = await rQuests.json();
      const dRecompensas = await rRecompensas.json();
      const dHabitos = await rHabitos.json();
      if (dEstado.error) throw new Error(dEstado.error);
      setJugador(dEstado.jugador ?? null);
      setEventosHoy(dEstado.eventosHoy ?? null);
      setQuests(dQuests.quests ?? dEstado.quests ?? []);
      setRecompensas(dRecompensas.recompensas ?? []);
      setHabitos((dHabitos.habitos ?? []).map((h: any) => ({ id: h.id, nombre: h.nombre })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  // ── Config: toggles SDT ──────────────────────────────────────────────────
  async function toggleConfig(campo: keyof Config) {
    if (!jugador || guardandoConfig) return;
    const valorNuevo = !jugador.config[campo];
    setGuardandoConfig(campo);
    setJugador({ ...jugador, config: { ...jugador.config, [campo]: valorNuevo } });
    try {
      const res = await fetch('/api/os/juego/estado', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: valorNuevo }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.config) setJugador((cur) => (cur ? { ...cur, config: data.config } : cur));
    } catch (e) {
      setJugador((cur) => (cur ? { ...cur, config: { ...cur.config, [campo]: !valorNuevo } } : cur));
      setError(e instanceof Error ? e.message : 'No se pudo guardar la config');
    } finally {
      setGuardandoConfig(null);
    }
  }

  // ── Tienda ────────────────────────────────────────────────────────────────
  const recompensasActivas = useMemo(() => recompensas.filter((r) => r.estado === 'activa'), [recompensas]);

  async function canjear(r: Recompensa) {
    if (canjeando || !jugador) return;
    if (jugador.oro < r.costo_oro) return;
    setCanjeando(r.id);
    setFeedbackTienda('');
    setError('');
    try {
      const res = await fetch('/api/os/juego/recompensas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canjear: r.id }),
      });
      const data = await res.json();
      if (res.status === 409) { setError(`Te faltan ${data.faltan ?? '?'} de oro para "${r.nombre}".`); return; }
      if (data.error) throw new Error(data.error);
      setFeedbackTienda(`Canjeado · -${r.costo_oro} oro · ${r.nombre}`);
      window.dispatchEvent(new CustomEvent('os:xp', { detail: { oro: -r.costo_oro } }));
      setTimeout(() => setFeedbackTienda(''), 2400);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo canjear');
    } finally {
      setCanjeando(null);
    }
  }

  async function crearRecompensa(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoR) return;
    const costo = Number(costoR);
    if (!nombreR.trim() || !Number.isFinite(costo) || costo <= 0) return;
    setEnviandoR(true);
    setError('');
    try {
      const res = await fetch('/api/os/juego/recompensas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreR.trim(), costo_oro: costo, descripcion: descR.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNombreR(''); setCostoR('50'); setDescR(''); setFormRecompensaAbierto(false);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la recompensa');
    } finally {
      setEnviandoR(false);
    }
  }

  // ── Quests ────────────────────────────────────────────────────────────────
  const questsActivas = useMemo(() => quests.filter((q) => q.estado === 'activa'), [quests]);
  const questsHistorial = useMemo(() => quests.filter((q) => q.estado !== 'activa'), [quests]);

  async function crearQuest(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoQ) return;
    setErrorQ('');
    const meta = Number(metaQ);
    const apuesta = Number(apuestaQ);
    const premioXp = Number(premioXpQ);
    const premioOro = Number(premioOroQ);
    if (!tituloQ.trim() || !Number.isFinite(meta) || meta <= 0) return;
    if (tipoObjQ === 'habito' && !habitoIdQ) { setErrorQ('Selecciona un hábito.'); return; }
    const objetivo: ObjetivoQuest = tipoObjQ === 'evento'
      ? { tipo: 'evento', evento: eventoQ, meta }
      : { tipo: 'habito', habito_id: habitoIdQ, meta };
    setEnviandoQ(true);
    try {
      const res = await fetch('/api/os/juego/quests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloQ.trim(), objetivo,
          apuesta_oro: Number.isFinite(apuesta) ? apuesta : 0,
          premio_xp: Number.isFinite(premioXp) ? premioXp : 0,
          premio_oro: Number.isFinite(premioOro) ? premioOro : 0,
        }),
      });
      const data = await res.json();
      if (res.status === 409) { setErrorQ(data.error ?? 'No tienes suficiente oro para esta apuesta.'); return; }
      if (data.error) throw new Error(data.error);
      setTituloQ(''); setMetaQ('3'); setApuestaQ('20'); setPremioXpQ('30'); setPremioOroQ('0'); setHabitoIdQ('');
      setFormQuestAbierto(false);
      await cargar(false);
    } catch (e) {
      setErrorQ(e instanceof Error ? e.message : 'No se pudo crear la quest');
    } finally {
      setEnviandoQ(false);
    }
  }

  async function cancelarQuest(id: string) {
    if (cancelando) return;
    if (!(await confirm({
      title: 'Cancelar quest',
      text: 'Si tenias apuesta de oro, se pierde igual que un fallo.',
      confirmLabel: 'Cancelar quest',
      danger: true,
    }))) return;
    setCancelando(id);
    setError('');
    try {
      const res = await fetch(`/api/os/juego/quests?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cancelar' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar');
    } finally {
      setCancelando(null);
    }
  }

  function nombreObjetivo(o: ObjetivoQuest): string {
    if (o.tipo === 'habito') {
      const h = habitos.find((x) => x.id === o.habito_id);
      return h ? h.nombre : 'Hábito';
    }
    const ev = EVENTOS.find((x) => x.value === o.evento);
    return ev ? ev.label : (o.evento ?? '');
  }

  // ── Derivados de HP/nivel ────────────────────────────────────────────────
  const hpSegmentos = 10;
  const hpPct = jugador ? jugador.hp / Math.max(1, jugador.hp_max) : 1;
  const hpLlenos = Math.round(hpPct * hpSegmentos);
  const hpCritico = hpPct < 0.3;
  const nivelProgresoPct = useMemo(() => {
    const p = jugador?.nivel.progreso ?? 0;
    const pct = p <= 1 ? p * 100 : p;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [jugador]);

  if (loading) {
    return <Spinner label="Cargando el juego..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--m-accent-text)', fontSize: 13, fontFamily: 'var(--m-font-rounded)' }}>
          <span>{error}</span>
          <button className="m-btn-ghost" onClick={() => cargar()}>Reintentar</button>
        </div>
      )}

      {/* ── Estado ── */}
      <div>
        <p className="m-section-title">Estado</p>
        <div className="m-hud">
          {jugador?.config.hp_activo && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span className="m-hud-label" style={{ margin: 0 }}>Vida</span>
                <span
                  className="m-telemetria"
                  style={{ color: hpCritico ? 'var(--m-danger)' : 'var(--m-fg)', fontWeight: 700 }}
                >
                  {jugador.hp} / {jugador.hp_max}
                </span>
              </div>
              <div className="m-hp-bar">
                {Array.from({ length: hpSegmentos }).map((_, i) => (
                  <div
                    key={i}
                    className={`m-hp-seg${i < hpLlenos ? (hpCritico ? ' is-critico' : ' is-lleno') : ''}`}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="m-hud-label">Nivel</p>
          <p className="m-hud-num" style={{ fontSize: 'clamp(2.25rem, 14vw, 4rem)' }}>
            {jugador?.nivel.nivel ?? 1}
          </p>
          <div className="m-telemetria" style={{ marginTop: 8 }}>
            <strong>{jugador?.xp_total ?? 0} XP</strong>
            <span>·</span>
            <span>{jugador?.nivel.xpSiguiente ?? 0} para subir</span>
          </div>
          <ProgressBar pct={nivelProgresoPct} />

          <div className="m-telemetria" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            {jugador?.config.oro_activo && (
              <span>Oro <strong style={{ color: 'var(--m-champagne)' }}>⛁ {jugador?.oro ?? 0}</strong></span>
            )}
            <span>XP hoy <strong>+{eventosHoy?.xp ?? 0}</strong></span>
            {jugador?.config.oro_activo && <span>Oro hoy <strong>+{eventosHoy?.oro ?? 0}</strong></span>}
          </div>
        </div>
      </div>

      {/* ── Tienda ── */}
      {jugador?.config.oro_activo && (
        <div>
          <p className="m-section-title">Tienda</p>
          {feedbackTienda && <p className="m-terminal-line is-flash" style={{ marginBottom: 8 }}>{feedbackTienda}</p>}
          {recompensasActivas.length === 0 && !formRecompensaAbierto ? (
            <p style={{ fontSize: 13, color: 'var(--m-muted)', fontFamily: 'var(--m-font-rounded)', marginBottom: 8 }}>
              Sin recompensas activas. Crea la primera.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {recompensasActivas.map((r) => {
                const faltan = jugador ? Math.max(0, r.costo_oro - jugador.oro) : r.costo_oro;
                const puede = faltan === 0;
                const enVuelo = canjeando === r.id;
                return (
                  <div key={r.id} className="m-tienda-row">
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--m-fg)' }}>{r.nombre}</span>
                        {r.veces_canjeada > 0 && (
                          <span className="m-estado">×{r.veces_canjeada}</span>
                        )}
                      </div>
                      {r.descripcion && <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>{r.descripcion}</p>}
                    </div>
                    <span className="m-precio">⛁ {r.costo_oro}</span>
                    <button
                      className="m-btn"
                      disabled={!puede || enVuelo}
                      onClick={() => canjear(r)}
                    >
                      {enVuelo ? 'Canjeando...' : puede ? 'Canjear' : `Te faltan ${faltan}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {formRecompensaAbierto ? (
            <form onSubmit={crearRecompensa} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="m-label">Nombre</label>
                <input className="m-input" value={nombreR} onChange={(e) => setNombreR(e.target.value)} placeholder="Ej. Serie de Netflix" required />
              </div>
              <div>
                <label className="m-label">Costo en oro</label>
                <input className="m-input" type="number" min={1} value={costoR} onChange={(e) => setCostoR(e.target.value)} required />
              </div>
              <div>
                <label className="m-label">Descripción (opcional)</label>
                <input className="m-input" value={descR} onChange={(e) => setDescR(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="m-btn" disabled={enviandoR}>{enviandoR ? 'Guardando...' : 'Guardar'}</button>
                <button type="button" className="m-btn-ghost" onClick={() => setFormRecompensaAbierto(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="m-btn-ghost" onClick={() => setFormRecompensaAbierto(true)}>+ Recompensa</button>
          )}
        </div>
      )}

      {/* ── Quests de la semana ── */}
      {/* Siempre visible: es un commitment device (Ariely), mecanica distinta al loot
          aleatorio; loot_activo solo controla el loot aleatorio dentro del motor. */}
      {(
        <div>
          <p className="m-section-title">Quests de la semana</p>
          {questsActivas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--m-muted)', fontFamily: 'var(--m-font-rounded)', marginBottom: 8 }}>
              Sin quests activas esta semana.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
              {questsActivas.map((q) => {
                const meta = q.progreso?.meta ?? q.objetivo.meta;
                const progresoActual = q.progreso?.progreso ?? 0;
                const pct = meta > 0 ? Math.round((progresoActual / meta) * 100) : 0;
                const enVuelo = cancelando === q.id;
                return (
                  <div key={q.id} className="m-journey-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--m-fg)', fontFamily: 'var(--m-font-rounded)' }}>
                          {q.titulo}
                        </span>
                        <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '4px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                          {nombreObjetivo(q.objetivo)} · meta {meta}
                        </p>
                      </div>
                      {q.apuesta_oro > 0 && (
                        <div style={{ textAlign: 'right' }}>
                          <span className="m-precio" style={{ color: 'var(--m-champagne)' }}>Apuesta ⛁ {q.apuesta_oro}</span>
                          <p style={{ fontSize: 13, color: 'var(--m-accent-text)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                            Si fallas la pierdes
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--m-font-rounded)', color: 'var(--m-muted)', marginBottom: 4 }}>
                        <span>{progresoActual} / {meta}</span>
                        <span>+{q.premio_xp} XP{q.premio_oro > 0 ? ` · +${q.premio_oro} oro` : ''}</span>
                      </div>
                      <ProgressBar pct={pct} />
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <button className="m-btn-ghost is-danger" disabled={enVuelo} onClick={() => cancelarQuest(q.id)}>
                        {enVuelo ? 'Cancelando...' : 'Cancelar quest'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {formQuestAbierto ? (
            <form onSubmit={crearQuest} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {errorQ && <p style={{ fontSize: 13, color: 'var(--m-accent-text)', fontFamily: 'var(--m-font-rounded)', margin: 0 }}>{errorQ}</p>}
              <div>
                <label className="m-label">Título</label>
                <input className="m-input" value={tituloQ} onChange={(e) => setTituloQ(e.target.value)} placeholder="Ej. 4 sesiones de gym esta semana" required />
              </div>
              <div>
                <label className="m-label">Tipo de objetivo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`m-pill${tipoObjQ === 'evento' ? ' is-activo' : ''}`} onClick={() => setTipoObjQ('evento')}>Conteo de eventos</button>
                  <button type="button" className={`m-pill${tipoObjQ === 'habito' ? ' is-activo' : ''}`} onClick={() => setTipoObjQ('habito')}>Hábito específico</button>
                </div>
              </div>
              {tipoObjQ === 'evento' ? (
                <div>
                  <label className="m-label">Evento</label>
                  <select className="m-input" value={eventoQ} onChange={(e) => setEventoQ(e.target.value as ObjetivoQuest['evento'])}>
                    {EVENTOS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="m-label">Hábito</label>
                  <select className="m-input" value={habitoIdQ} onChange={(e) => setHabitoIdQ(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {habitos.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="m-label">Meta (número de veces)</label>
                <input className="m-input" type="number" min={1} value={metaQ} onChange={(e) => setMetaQ(e.target.value)} required />
              </div>
              <div>
                <label className="m-label">Apuesta de oro</label>
                <input className="m-input" type="number" min={0} value={apuestaQ} onChange={(e) => setApuestaQ(e.target.value)} />
                <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '6px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                  Pre-compromiso estilo Ariely: apuesta oro que pierdes si no cumples.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="m-label">Premio XP</label>
                  <input className="m-input" type="number" min={0} value={premioXpQ} onChange={(e) => setPremioXpQ(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="m-label">Premio oro</label>
                  <input className="m-input" type="number" min={0} value={premioOroQ} onChange={(e) => setPremioOroQ(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="m-btn" disabled={enviandoQ}>{enviandoQ ? 'Creando...' : 'Crear quest'}</button>
                <button type="button" className="m-btn-ghost" onClick={() => { setFormQuestAbierto(false); setErrorQ(''); }}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="m-btn-ghost" onClick={() => setFormQuestAbierto(true)}>+ Quest</button>
          )}

          {questsHistorial.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button className="m-btn-ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => setHistorialAbierto(!historialAbierto)}>
                {historialAbierto ? '▾' : '▸'} Historial ({questsHistorial.length})
              </button>
              {historialAbierto && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {questsHistorial.map((q) => (
                    <div key={q.id} className="m-mission" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--m-fg)' }}>{q.titulo}</span>
                      {q.estado === 'ganada' && <span className="m-estado is-ok">Ganada</span>}
                      {q.estado === 'perdida' && <span className="m-estado" style={{ color: 'var(--m-accent-text)' }}>Perdida</span>}
                      {q.estado === 'cancelada' && <span className="m-estado">Cancelada</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Config ── */}
      <div>
        <p className="m-section-title">Config</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="m-switch-row">
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-fg)', margin: 0 }}>HP</p>
              <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                Apaga las mecánicas que te estorben; el sistema es tuyo.
              </p>
            </div>
            <Switch on={!!jugador?.config.hp_activo} disabled={guardandoConfig === 'hp_activo'} onToggle={() => toggleConfig('hp_activo')} />
          </div>
          <div className="m-switch-row">
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-fg)', margin: 0 }}>Oro</p>
              <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                Apaga las mecánicas que te estorben; el sistema es tuyo.
              </p>
            </div>
            <Switch on={!!jugador?.config.oro_activo} disabled={guardandoConfig === 'oro_activo'} onToggle={() => toggleConfig('oro_activo')} />
          </div>
          <div className="m-switch-row">
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-fg)', margin: 0 }}>Loot y quests</p>
              <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '2px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                Apaga las mecánicas que te estorben; el sistema es tuyo.
              </p>
            </div>
            <Switch on={!!jugador?.config.loot_activo} disabled={guardandoConfig === 'loot_activo'} onToggle={() => toggleConfig('loot_activo')} />
          </div>
        </div>
      </div>
      {sheet}
    </div>
  );
}
