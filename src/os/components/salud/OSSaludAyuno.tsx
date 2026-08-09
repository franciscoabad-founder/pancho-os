import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, EmptyState, useConfirm } from '../ui';
import { FASES_AYUNO, faseActual, duracionHoras, formatearDuracion } from '../../../lib/salud/ayuno';

interface Ayuno {
  id: string; inicio: string; fin: string | null;
  protocolo: string; objetivo_horas: number; notas: string | null;
}

// Presets Yazio-style (Fase 5). El default se persiste en la columna existente
// salud_config.protocolo_ayuno_default (+ horas custom en ayuno_objetivo_h) vía PATCH
// /api/os/salud/config. Al iniciar un ayuno se manda el preset tal cual: el endpoint de
// ayunos mapea '24h'/'36h' al enum legacy de la columna ayunos.protocolo y snapshotea
// las horas reales en ayunos.objetivo_horas.
const PRESETS: Array<{ key: string; label: string; horas: number | null }> = [
  { key: '16_8', label: '16:8', horas: 16 },
  { key: '24h', label: '24h', horas: 24 },
  { key: '36h', label: '36h', horas: 36 },
  { key: 'custom', label: 'Personalizado', horas: null },
];

const card: React.CSSProperties = {
  background: 'var(--os-surface-2)', border: '1px solid var(--os-line-soft)',
  borderRadius: 'var(--os-r-card)', padding: '1rem',
};
const cardAviso: React.CSSProperties = {
  ...card,
  background: 'color-mix(in srgb, var(--os-warn) 14%, var(--os-surface-2))',
  border: '1px solid color-mix(in srgb, var(--os-warn) 35%, transparent)',
};
const selStyle: React.CSSProperties = {
  background: 'var(--os-surface)', border: '1px solid var(--os-line)', borderRadius: 'var(--os-r-sm)',
  padding: '8px 10px', fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', outline: 'none', minHeight: 40,
};
const pill: React.CSSProperties = {
  background: 'var(--os-surface)', color: 'var(--os-text-2)', border: '1px solid var(--os-line)',
  borderRadius: 'var(--os-r-full)', padding: '8px 16px', minHeight: 36, fontSize: 'var(--os-text-sm)', fontWeight: 600, cursor: 'pointer',
};
const pillActivo: React.CSSProperties = {
  background: 'var(--os-accent)', color: '#fff', border: '1px solid var(--os-accent)',
};

export default function OSSaludAyuno() {
  const { confirm, sheet } = useConfirm();
  const [activo, setActivo] = useState<Ayuno | null>(null);
  const [finPrevisto, setFinPrevisto] = useState<string | null>(null);
  const [sugerencia, setSugerencia] = useState<string | null>(null);
  const [sugerenciaDescartada, setSugerenciaDescartada] = useState(false);
  const [historial, setHistorial] = useState<Ayuno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('16_8');
  const [objetivoCustom, setObjetivoCustom] = useState(16);
  const [nowMs, setNowMs] = useState<number>(0); // tick de reloj; 0 hasta montar (evita hydration mismatch)
  const [editId, setEditId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState({ inicio: '', fin: '' });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function cargar() {
    setLoading(true); setError('');
    try {
      const [resAbierto, resHist] = await Promise.all([
        fetch('/api/os/salud/ayunos?abierto=1'),
        fetch('/api/os/salud/ayunos'),
      ]);
      const dataAbierto = await resAbierto.json();
      const dataHist = await resHist.json();
      if (dataAbierto.error) throw new Error(dataAbierto.error);
      setActivo(dataAbierto.ayuno ?? null);
      setFinPrevisto(dataAbierto.fin_previsto ?? null);
      setSugerencia(dataAbierto.sugerencia ?? null);
      setSugerenciaDescartada(false);
      if (!dataAbierto.ayuno) {
        // El pill selector solo importa cuando no hay ayuno activo (elige el objetivo
        // del próximo ayuno). Se sincroniza con protocolo_ayuno_default de salud_config;
        // tokens legacy sin pill propio ('18_6', 'omad', etc.) se muestran como custom.
        const protocoloConfig = dataAbierto.protocolo ?? '16_8';
        setPreset(PRESETS.some((p) => p.key === protocoloConfig) ? protocoloConfig : 'custom');
        setObjetivoCustom(dataAbierto.objetivo_h ?? 16);
      }
      setHistorial(dataHist.ayunos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // Tick de reloj SOLO para re-render del display. El estado real vive en DB (inicio).
  useEffect(() => {
    setNowMs(Date.now());
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Persiste el preset elegido como default en salud_config (protocolo_ayuno_default +
  // ayuno_objetivo_h, vía la acción {protocolo, objetivo_h} del PATCH en config.ts).
  async function cambiarProtocolo(nuevoPreset: string, objetivoOverride?: number) {
    setPreset(nuevoPreset);
    try {
      const body: Record<string, unknown> = { protocolo: nuevoPreset };
      if (nuevoPreset === 'custom') body.objetivo_h = objetivoOverride ?? objetivoCustom;
      await fetch('/api/os/salud/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } catch { /* silencioso: el preset local ya quedó elegido para iniciar el ayuno */ }
  }

  async function iniciar() {
    setError('');
    const p = PRESETS.find((x) => x.key === preset) ?? PRESETS[0];
    const horas = preset === 'custom' ? (objetivoCustom || 16) : (p.horas as number);
    try {
      const res = await fetch('/api/os/salud/ayunos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo: preset, objetivo_horas: horas }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function terminar() {
    if (!activo) return;
    try {
      await fetch(`/api/os/salud/ayunos?id=${activo.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fin: new Date().toISOString() }),
      });
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function guardarEdicion(id: string) {
    try {
      const body: Record<string, unknown> = {};
      if (editVals.inicio) body.inicio = new Date(editVals.inicio).toISOString();
      if (editVals.fin) body.fin = new Date(editVals.fin).toISOString();
      await fetch(`/api/os/salud/ayunos?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      setEditId(null);
      cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function borrar(id: string) {
    if (!(await confirm({
      title: 'Borrar ayuno',
      text: 'Esta accion no se puede deshacer.',
      confirmLabel: 'Borrar',
      danger: true,
    }))) return;
    await fetch(`/api/os/salud/ayunos?id=${id}`, { method: 'DELETE' });
    cargar();
  }

  const horasActual = useMemo(() => {
    if (!activo || !nowMs) return 0;
    return duracionHoras(activo.inicio, null, nowMs);
  }, [activo, nowMs]);

  const fase = faseActual(horasActual);
  // Objetivo informativo del ayuno en curso: su snapshot objetivo_horas. NUNCA se usa
  // para auto-cerrar: el ring se capa visualmente en 100% y el timer sigue contando.
  const objetivoActivo = activo ? (activo.objetivo_horas ?? 16) : 0;
  const progresoPct = objetivoActivo > 0 ? Math.min(100, (horasActual / objetivoActivo) * 100) : 0;
  const horasPasadoObjetivo = activo ? Math.max(0, horasActual - objetivoActivo) : 0;
  const cumplioObjetivo = activo ? horasActual >= objetivoActivo : false;
  const colorRing = cumplioObjetivo ? 'var(--os-champagne)' : 'var(--os-accent)';
  const C = 2 * Math.PI * 54;

  // Racha semanal: ayunos completados (con fin) en los últimos 7 días.
  const racha = useMemo(() => {
    const hace7 = Date.now() - 7 * 86400000;
    return historial.filter((a) => a.fin && new Date(a.inicio).getTime() >= hace7).length;
  }, [historial]);

  function inputLocal(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  }

  function fmtFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && <div style={{ color: 'var(--os-error)', fontSize: 'var(--os-text-sm)' }}>{error}</div>}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Nudge manual-first: nadie tocó el módulo de ayuno ayer. Nunca abre/cierra
              nada por su cuenta, solo pregunta (ver GET en ayunos.ts). */}
          {!activo && sugerencia === 'sin_registro' && !sugerenciaDescartada && (
            <div style={cardAviso}>
              <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                No has registrado tu estado. ¿Sigues comiendo o ya estás ayunando?
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={iniciar}>Ya estoy ayunando</Button>
                <Button variant="ghost" onClick={() => setSugerenciaDescartada(true)}>Sigo comiendo</Button>
              </div>
            </div>
          )}

          {activo ? (
            // ── Ayuno en curso: timer en vivo ──
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 220, height: 220 }}>
                <svg viewBox="0 0 120 120" width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="54" fill="none" stroke="var(--os-line)" strokeWidth="8" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={colorRing} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(progresoPct / 100) * C} ${C}`}
                    style={{ transition: 'stroke-dasharray 1s linear, stroke .3s' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 32, fontWeight: 800, lineHeight: 1, color: 'var(--os-text)' }}>
                    {formatearDuracion(horasActual)}
                  </span>
                  <span style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', marginTop: 4 }}>de {objetivoActivo}h objetivo</span>
                  {horasPasadoObjetivo > 0 && (
                    <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--os-champagne)', marginTop: 6 }}>
                      +{formatearDuracion(horasPasadoObjetivo)}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 15, fontWeight: 700, color: 'var(--os-accent-light)', margin: 0 }}>{fase.nombre}</p>
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-text-2)', margin: '4px 0 0', maxWidth: 340, lineHeight: 1.4 }}>{fase.descripcion}</p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: 0 }}>
                  Inició {fmtFecha(activo.inicio)} · {activo.protocolo}
                </p>
                {finPrevisto && (
                  <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '2px 0 0' }}>
                    Fin previsto {fmtFecha(finPrevisto)} (informativo, no se auto-cierra)
                  </p>
                )}
              </div>

              <Button onClick={terminar}>Terminar ayuno</Button>
            </div>
          ) : (
            // ── Sin ayuno activo: elegir protocolo e iniciar ──
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <p style={{ fontSize: 'var(--os-text-base)', color: 'var(--os-text-2)', margin: 0 }}>No hay ayuno activo.</p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    style={{ ...pill, ...(preset === p.key ? pillActivo : {}) }}
                    onClick={() => cambiarProtocolo(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {preset === 'custom' && (
                <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  Horas objetivo
                  <input
                    type="number" min={1} max={168} step={0.5}
                    value={objetivoCustom}
                    onChange={(e) => setObjetivoCustom(Number(e.target.value) || 0)}
                    onBlur={() => cambiarProtocolo('custom', objetivoCustom)}
                    style={{ ...selStyle, width: 80 }}
                  />
                </label>
              )}

              <Button onClick={iniciar}>Empezar ayuno</Button>
            </div>
          )}
        </>
      )}

      {/* Fases (referencia) */}
      <div style={card}>
        <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 10px' }}>Fases del ayuno</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FASES_AYUNO.map((f) => {
            const activa = activo && fase.key === f.key;
            return (
              <div key={f.key} style={{ display: 'flex', gap: 10, padding: '6px 8px', borderRadius: 'var(--os-r-sm)', background: activa ? 'color-mix(in srgb, var(--os-accent) 13%, transparent)' : 'transparent' }}>
                <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 11, color: activa ? 'var(--os-accent-light)' : 'var(--os-muted)', minWidth: 54 }}>
                  {f.hasta === Infinity ? `${f.desde}h+` : `${f.desde}-${f.hasta}h`}
                </span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: activa ? 700 : 500, color: activa ? 'var(--os-text)' : 'var(--os-text-2)' }}>{f.nombre}</span>
                  <p style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', margin: '1px 0 0', lineHeight: 1.35 }}>{f.descripcion}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Racha semanal */}
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text-2)' }}>Ayunos completados (7 días)</span>
        <span style={{ fontFamily: 'var(--os-font-mono)', fontSize: 18, color: 'var(--os-champagne)', fontWeight: 700 }}>{racha}</span>
      </div>

      {/* Historial */}
      <div style={card}>
        <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: '0 0 10px' }}>Historial</p>
        {historial.length === 0 ? (
          <EmptyState icon="timer" title="Sin registros aún" text="Tu primer ayuno aparecerá aquí al iniciarlo." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historial.slice(0, 20).map((a) => {
              const dur = duracionHoras(a.inicio, a.fin, nowMs || undefined);
              const objetivoFila = a.objetivo_horas ?? 16;
              const cumplido = dur >= objetivoFila;
              return (
                <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--os-line-soft)' }}>
                  {editId === a.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Inicio
                        <input type="datetime-local" style={{ ...selStyle, width: '100%', marginTop: 2 }} value={editVals.inicio} onChange={(e) => setEditVals({ ...editVals, inicio: e.target.value })} /></label>
                      <label style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>Fin
                        <input type="datetime-local" style={{ ...selStyle, width: '100%', marginTop: 2 }} value={editVals.fin} onChange={(e) => setEditVals({ ...editVals, fin: e.target.value })} /></label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" onClick={() => guardarEdicion(a.id)}>Guardar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-text)' }}>
                          {new Date(a.inicio).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} · {a.protocolo}
                        </span>
                        <p style={{ fontSize: 'var(--os-text-xs)', fontFamily: 'var(--os-font-mono)', color: cumplido ? 'var(--os-ok)' : 'var(--os-muted)', margin: '2px 0 0' }}>
                          {formatearDuracion(dur)} / {objetivoFila}h {a.fin ? (cumplido ? '✓' : '') : '· en curso'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button variant="ghost" size="sm" onClick={() => { setEditId(a.id); setEditVals({ inicio: inputLocal(a.inicio), fin: inputLocal(a.fin) }); }} title="Editar">✎</Button>
                        <Button variant="danger" size="sm" onClick={() => borrar(a.id)} title="Borrar">✕</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {sheet}
    </div>
  );
}
