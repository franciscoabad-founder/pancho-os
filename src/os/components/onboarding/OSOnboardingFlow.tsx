import { useEffect, useState, type ReactNode } from 'react';

// Framework generico de onboarding estilo Yazio: config-driven, se reusa para el
// intro del OS y para el flujo de Salud (ver flujoOs.ts / flujoSalud.ts). El host
// (quien monta <OSOnboardingFlow>) decide CUANDO mostrarlo (chequea completado_at);
// el framework solo maneja el recorrido de pasos, la persistencia y el render.

export type Respuestas = Record<string, any>;

export interface OpcionItem {
  value: string;
  label: string;
  icono?: string;
  descripcion?: string;
}

export interface NumeroCampoConfig {
  key: string;
  label: string;
  sufijo?: string;
  sugerido?: (respuestas: Respuestas) => number | undefined;
}

export interface TextoCampoConfig {
  key: string;
  label: string;
  placeholder?: string;
  multilinea?: boolean;
  sugerido?: (respuestas: Respuestas) => string | undefined;
}

export interface ResumenItem {
  label: string;
  valor: (respuestas: Respuestas) => string;
  editKey?: string;
}

export type PasoConfig =
  | { key: string; tipo: 'intro'; titulo: string; copy?: string; visual?: ReactNode; ctaLabel?: string }
  | { key: string; tipo: 'opciones'; titulo: string; copy?: string; opciones: OpcionItem[]; ctaLabel?: string; requerido?: boolean }
  | { key: string; tipo: 'multi'; titulo: string; copy?: string; opciones: OpcionItem[]; ctaLabel?: string }
  | { key: string; tipo: 'numero'; titulo: string; copy?: string; campos: NumeroCampoConfig[]; unidades?: string[]; unidadDefault?: string; ctaLabel?: string }
  | { key: string; tipo: 'texto'; titulo: string; copy?: string; campos: TextoCampoConfig[]; ctaLabel?: string; requerido?: boolean }
  | { key: string; tipo: 'dias'; titulo: string; copy?: string; ctaLabel?: string }
  | { key: string; tipo: 'construyendo'; titulo?: string; mensaje?: string; duracionMs?: number }
  | { key: string; tipo: 'resumen'; titulo: string; copy?: string; items: ResumenItem[]; ctaLabel: string };

interface Props {
  modulo: string;
  pasos: PasoConfig[];
  onFinish: () => void;
  /** Ejecutado al completar el ultimo paso, ANTES de marcar completado_at. Si lanza, se muestra el error y no se cierra el flujo. */
  onCompletar?: (respuestas: Respuestas) => Promise<void> | void;
  respuestasIniciales?: Respuestas;
}

const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // ISO 1..7

export default function OSOnboardingFlow({ modulo, pasos, onFinish, onCompletar, respuestasIniciales }: Props) {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales ?? {});
  const [cargado, setCargado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/os/onboarding?modulo=${encodeURIComponent(modulo)}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelado) return;
        if (data?.estado && !data.estado.completado_at) {
          setRespuestas((prev) => ({ ...(respuestasIniciales ?? {}), ...prev, ...(data.estado.respuestas ?? {}) }));
          if (typeof data.estado.paso === 'number' && data.estado.paso >= 0 && data.estado.paso < pasos.length) {
            setPaso(data.estado.paso);
          }
        }
      } catch {
        // Sin conexion: arranca desde el paso 0, no bloquea el flujo.
      } finally {
        if (!cancelado) setCargado(true);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  const total = pasos.length;
  const step = pasos[Math.min(paso, total - 1)];
  const esUltimo = paso === total - 1;
  const progreso = Math.round(((paso + 1) / total) * 100);

  function persistir(nuevoPaso: number, nuevasRespuestas: Respuestas, completado?: boolean) {
    return fetch('/api/os/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modulo,
        paso: nuevoPaso,
        respuestas: nuevasRespuestas,
        ...(completado ? { completado: true } : {}),
      }),
    }).catch(() => null);
  }

  function actualizarValor(key: string, value: unknown) {
    setRespuestas((prev) => ({ ...prev, [key]: value }));
  }

  // Antes de avanzar de un paso 'numero', rellena los campos vacios con su sugerido
  // (si existe) para que la respuesta guardada nunca quede a medias.
  function resolverRespuestasPaso(): Respuestas {
    if (step.tipo !== 'numero' && step.tipo !== 'texto') return respuestas;
    const valores: Record<string, unknown> = { ...(respuestas[step.key] ?? {}) };
    for (const campo of step.campos) {
      const vacio = step.tipo === 'texto'
        ? valores[campo.key] == null || String(valores[campo.key]).trim() === ''
        : valores[campo.key] == null;
      if (vacio) {
        const sugerido = campo.sugerido?.(respuestas);
        if (sugerido != null) valores[campo.key] = sugerido;
      }
    }
    return { ...respuestas, [step.key]: valores };
  }

  async function avanzar() {
    const resueltas = resolverRespuestasPaso();
    if (resueltas !== respuestas) setRespuestas(resueltas);

    if (esUltimo) return completar(resueltas);

    const siguientePaso = paso + 1;
    setPaso(siguientePaso);
    persistir(siguientePaso, resueltas);
  }

  function retroceder() {
    if (paso === 0) return;
    const anteriorPaso = paso - 1;
    setPaso(anteriorPaso);
    persistir(anteriorPaso, respuestas);
  }

  async function completar(respuestasActuales: Respuestas) {
    setEnviando(true);
    setError('');
    try {
      // Persiste las respuestas ANTES de onCompletar: si el host aplica config
      // leyendo onboarding_estado desde el servidor (caso Salud), necesita ver
      // ya escritas las respuestas del ultimo paso (el resumen).
      await persistir(paso, respuestasActuales);
      if (onCompletar) await onCompletar(respuestasActuales);
      await persistir(paso, respuestasActuales, true);
      onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el paso');
    } finally {
      setEnviando(false);
    }
  }

  // Pantalla "construyendo": avanza sola despues de duracionMs.
  useEffect(() => {
    if (step?.tipo !== 'construyendo') return;
    const ms = step.duracionMs ?? 2500;
    const t = setTimeout(() => { avanzar(); }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, step?.tipo]);

  if (!cargado) return null;

  function puedeAvanzar(): boolean {
    if (enviando) return false;
    if (step.tipo === 'opciones' && step.requerido !== false) {
      return respuestas[step.key] != null;
    }
    if (step.tipo === 'texto' && step.requerido) {
      const valores: Record<string, unknown> = respuestas[step.key] ?? {};
      return step.campos.every((c) => {
        const valor = valores[c.key];
        if (valor != null && String(valor).trim() !== '') return true;
        return c.sugerido?.(respuestas) != null;
      });
    }
    return true;
  }

  function saltarAPaso(key?: string) {
    if (!key) return;
    const idx = pasos.findIndex((p) => p.key === key);
    if (idx >= 0) setPaso(idx);
  }

  const titulo = 'titulo' in step ? step.titulo : undefined;
  const copy = 'copy' in step ? step.copy : undefined;

  function renderTitulo() {
    if (!titulo) return null;
    return (
      <h1 style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 24, fontWeight: 800, color: 'var(--os-text)', margin: 0, lineHeight: 1.25 }}>
        {titulo}
      </h1>
    );
  }
  function renderCopy() {
    if (!copy) return null;
    return <p style={{ fontSize: 14, color: 'var(--os-text-2)', lineHeight: 1.6, margin: 0 }}>{copy}</p>;
  }

  function renderPaso() {
    switch (step.tipo) {
      case 'intro':
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            {step.visual}
          </>
        );

      case 'opciones': {
        const seleccion = respuestas[step.key];
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {step.opciones.map((o) => {
                const activo = seleccion === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => actualizarValor(step.key, o.value)}
                    className="os-card os-card-interactive"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%',
                      border: activo ? '2px solid var(--os-accent)' : '1px solid var(--os-line)',
                      background: activo ? 'rgba(59,78,217,0.07)' : 'var(--os-surface)',
                      minHeight: 56, padding: '0.9rem 1rem',
                    }}
                  >
                    {o.icono && (
                      <span className="material-symbols-outlined" style={{ fontSize: 24, color: activo ? 'var(--os-accent)' : 'var(--os-muted)', flexShrink: 0 }}>
                        {o.icono}
                      </span>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--os-text)' }}>{o.label}</span>
                      {o.descripcion && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--os-muted)', marginTop: 2 }}>{o.descripcion}</span>
                      )}
                    </span>
                    {activo && <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-accent)', flexShrink: 0 }}>check_circle</span>}
                  </button>
                );
              })}
            </div>
          </>
        );
      }

      case 'multi': {
        const seleccion: string[] = respuestas[step.key] ?? [];
        function toggle(value: string) {
          const next = seleccion.includes(value) ? seleccion.filter((v) => v !== value) : [...seleccion, value];
          actualizarValor(step.key, next);
        }
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {step.opciones.map((o) => {
                const activo = seleccion.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="os-pill"
                    style={{
                      cursor: 'pointer', border: activo ? 'none' : '1px solid var(--os-line)',
                      background: activo ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
                      color: activo ? '#fff' : 'var(--os-text-2)',
                      padding: '8px 16px', fontSize: 12, minHeight: 44,
                    }}
                  >
                    {o.icono && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{o.icono}</span>}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      }

      case 'numero': {
        const valores: Record<string, any> = respuestas[step.key] ?? {};
        const unidad = valores.unidad ?? step.unidadDefault ?? step.unidades?.[0];
        function setCampo(campoKey: string, value: number | undefined) {
          actualizarValor(step.key, { ...valores, [campoKey]: value });
        }
        function setUnidad(u: string) {
          actualizarValor(step.key, { ...valores, unidad: u });
        }
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            {step.unidades && step.unidades.length > 1 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {step.unidades.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnidad(u)}
                    className="os-pill"
                    style={{
                      cursor: 'pointer', border: 'none', minHeight: 36,
                      background: unidad === u ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
                      color: unidad === u ? '#fff' : 'var(--os-text-2)', padding: '6px 16px', fontSize: 11,
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: step.campos.length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 12 }}>
              {step.campos.map((c) => {
                const sugerido = c.sugerido?.(respuestas);
                const valor = valores[c.key];
                return (
                  <div key={c.key} className="os-card-2" style={{ padding: '12px 14px' }}>
                    <p className="os-eyebrow" style={{ marginBottom: 6 }}>{c.label}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={valor ?? ''}
                        placeholder={sugerido != null ? String(sugerido) : undefined}
                        onChange={(e) => setCampo(c.key, e.target.value === '' ? undefined : Number(e.target.value))}
                        style={{
                          border: 'none', background: 'transparent', fontFamily: 'var(--os-font-mono)',
                          fontSize: 26, fontWeight: 700, color: 'var(--os-champagne)', width: '100%', padding: 0, outline: 'none',
                        }}
                      />
                      {(c.sufijo || unidad) && <span style={{ fontSize: 13, color: 'var(--os-muted)' }}>{c.sufijo ?? unidad}</span>}
                    </div>
                    {sugerido != null && valor == null && (
                      <button
                        type="button"
                        onClick={() => setCampo(c.key, sugerido)}
                        className="os-pill os-pill-gold"
                        style={{ marginTop: 8, border: 'none', cursor: 'pointer' }}
                      >
                        sugerido: {sugerido}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      }

      case 'texto': {
        const valores: Record<string, any> = respuestas[step.key] ?? {};
        function setCampo(campoKey: string, value: string) {
          actualizarValor(step.key, { ...valores, [campoKey]: value });
        }
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {step.campos.map((c) => {
                const sugerido = c.sugerido?.(respuestas);
                const valor = valores[c.key] ?? '';
                return (
                  <div key={c.key} className="os-card-2" style={{ padding: '12px 14px' }}>
                    <p className="os-eyebrow" style={{ marginBottom: 6 }}>{c.label}</p>
                    {c.multilinea ? (
                      <textarea
                        rows={4}
                        value={valor}
                        placeholder={c.placeholder ?? sugerido}
                        onChange={(e) => setCampo(c.key, e.target.value)}
                        style={{
                          border: '1px solid var(--os-line)', background: 'var(--os-fill-subtle)',
                          borderRadius: 10, fontSize: 14, color: 'var(--os-text)', width: '100%',
                          padding: '10px 12px', outline: 'none', resize: 'vertical', minHeight: 84,
                          fontFamily: 'inherit', lineHeight: 1.5,
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={valor}
                        placeholder={c.placeholder ?? sugerido}
                        onChange={(e) => setCampo(c.key, e.target.value)}
                        style={{
                          border: '1px solid var(--os-line)', background: 'var(--os-fill-subtle)',
                          borderRadius: 10, fontSize: 14, color: 'var(--os-text)', width: '100%',
                          padding: '10px 12px', outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    )}
                    {sugerido != null && valor.trim() === '' && (
                      <button
                        type="button"
                        onClick={() => setCampo(c.key, sugerido)}
                        className="os-pill os-pill-gold"
                        style={{ marginTop: 8, border: 'none', cursor: 'pointer' }}
                      >
                        usar sugerido
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      }

      case 'dias': {
        const seleccion: number[] = respuestas[step.key] ?? [];
        function toggle(dia: number) {
          const next = seleccion.includes(dia) ? seleccion.filter((d) => d !== dia) : [...seleccion, dia].sort((a, b) => a - b);
          actualizarValor(step.key, next);
        }
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {DIAS_LABEL.map((label, i) => {
                const dia = i + 1;
                const activo = seleccion.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggle(dia)}
                    style={{
                      width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                      border: activo ? 'none' : '1px solid var(--os-line)',
                      background: activo ? 'var(--os-accent)' : 'var(--os-fill-subtle)',
                      color: activo ? '#fff' : 'var(--os-text-2)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        );
      }

      case 'construyendo':
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'var(--os-accent)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 20, padding: '2rem', textAlign: 'center',
          }}>
            <span className="material-symbols-outlined os-pulse-dot" style={{ fontSize: 52, color: '#fff' }}>auto_awesome</span>
            <p style={{ fontFamily: 'var(--os-font-rounded)', fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
              {step.titulo ?? 'Construyendo tu plan'}
            </p>
            <p className="os-pulse-dot" style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: 0 }}>
              {step.mensaje ?? 'Casi listo…'}
            </p>
          </div>
        );

      case 'resumen':
        return (
          <>
            {renderTitulo()}
            {renderCopy()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {step.items.map((it, i) => (
                <div key={i} className="os-card-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="os-eyebrow" style={{ marginBottom: 4 }}>{it.label}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--os-text)' }}>{it.valor(respuestas)}</p>
                  </div>
                  {it.editKey && (
                    <button
                      type="button"
                      onClick={() => saltarAPaso(it.editKey)}
                      style={{ background: 'none', border: 'none', color: 'var(--os-accent)', fontSize: 12, fontFamily: 'var(--os-font-display)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      editar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        );

      default:
        return null;
    }
  }

  const esConstruyendo = step.tipo === 'construyendo';
  const ctaLabel = 'ctaLabel' in step && step.ctaLabel
    ? step.ctaLabel
    : (paso === 0 ? 'Empezar' : 'Continuar');

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', zIndex: 500, background: 'var(--os-bg)', display: 'flex', flexDirection: 'column' }}>
      {!esConstruyendo && (
        <div style={{ padding: '14px 18px 4px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {paso > 0 ? (
              <button
                type="button"
                onClick={retroceder}
                aria-label="Atras"
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--os-text-2)', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
              </button>
            ) : <span style={{ width: 30 }} />}
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--os-line-soft)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--os-accent)', transition: 'width 0.3s ease', borderRadius: 999 }} />
            </div>
            <button
              type="button"
              onClick={onFinish}
              aria-label="Cerrar"
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--os-muted)', display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>
      )}

      {/* El CTA vive DENTRO del contenido, justo despues del paso: siempre visible
          al final de lo que se muestra, nunca tapado por bottom-nav ni barra del navegador. */}
      <div style={{ flex: 1, overflowY: 'auto', padding: esConstruyendo ? 0 : '10px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: 440, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {renderPaso()}
          {error && <p style={{ color: 'var(--os-error)', fontSize: 12, margin: 0 }}>{error}</p>}
          {!esConstruyendo && (
            <button
              type="button"
              className="os-btn"
              onClick={avanzar}
              disabled={!puedeAvanzar()}
              style={{
                width: '100%', padding: '0.9rem 1rem', borderRadius: 999, fontSize: 14, marginTop: 8,
                opacity: puedeAvanzar() ? 1 : 0.5, cursor: puedeAvanzar() ? 'pointer' : 'not-allowed',
              }}
            >
              {enviando ? 'Guardando…' : ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
