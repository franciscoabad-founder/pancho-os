import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Spinner } from './ui';

// ── Tipos (contrato del endpoint api/os/habitos/journeys.ts) ────────────────
export interface Etapa {
  id: string;
  journey_id: string;
  orden: number;
  nombre: string;
  contenido_slug: string;
  completada_at: string | null;
}
export interface ProgresoEtapa {
  cumplida: boolean;
  progreso: number; // 0..1
  hechos: number;
  meta: number;
}
export interface Journey {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  montana: 'foundations' | 'struggle' | 'mastery';
  orden: number;
  estado: 'bloqueado' | 'disponible' | 'en_curso' | 'completado';
  etapa_actual: number;
  etapas: Etapa[];
  progresoEtapa?: ProgresoEtapa;
}

// NOTA de diseño (ver comentario en pages/os/habitos/journeys.astro): esta isla NO
// recibe el HTML compilado de las cartas MDX. Astro renderiza las cartas completas de
// forma estática debajo, dentro de <details id="carta-<id>">. Aquí solo llega el
// resumen (para mostrar un preview en la etapa en curso) y el id para armar el enlace
// de anchor hacia la carta completa.
export interface CartaResumen {
  id: string; // '<journey>/<etapa-slug>', igual a etapa.contenido_slug
  title: string;
  resumen: string;
}

interface Props {
  cartas: CartaResumen[];
}

const MONTANAS: Array<{ key: Journey['montana']; label: string }> = [
  { key: 'foundations', label: 'Montaña 1 · Foundations' },
  { key: 'struggle', label: 'Montaña 2 · Struggle' },
  { key: 'mastery', label: 'Montaña 3 · Mastery' },
];

function Badge({ estado }: { estado: Journey['estado'] }) {
  if (estado === 'en_curso') return <span className="m-journey-estado en-curso">En curso</span>;
  if (estado === 'completado') return <span className="m-journey-estado completo">Completo</span>;
  if (estado === 'bloqueado') return <span className="m-journey-estado bloqueado">Bloqueado</span>;
  return <span className="m-journey-estado disponible">Disponible</span>;
}

export default function OSJourneys({ cartas }: Props) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accionando, setAccionando] = useState<string | null>(null); // journey.id o slug en curso de acción
  const [avisoAvance, setAvisoAvance] = useState<Record<string, string>>({});

  const cartasPorId = useMemo(() => {
    const mapa = new Map<string, CartaResumen>();
    for (const c of cartas) mapa.set(c.id, c);
    return mapa;
  }, [cartas]);

  async function cargar(mostrarLoading = true) {
    if (mostrarLoading) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/os/habitos/journeys');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJourneys(data.journeys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function iniciar(slug: string) {
    setAccionando(slug);
    setError('');
    try {
      const res = await fetch('/api/os/habitos/journeys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'iniciar', slug }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el journey');
    } finally {
      setAccionando(null);
    }
  }

  async function avanzar(journeyId: string) {
    setAccionando(journeyId);
    setError('');
    setAvisoAvance((prev) => ({ ...prev, [journeyId]: '' }));
    try {
      const res = await fetch('/api/os/habitos/journeys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'avanzar', journey_id: journeyId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        const faltan = Math.max(0, (data.progreso?.meta ?? 0) - (data.progreso?.hechos ?? 0));
        setAvisoAvance((prev) => ({ ...prev, [journeyId]: `Te faltan ${faltan} check${faltan === 1 ? '' : 's'} para poder avanzar.` }));
        return;
      }
      if (data.error) throw new Error(data.error);
      await cargar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo avanzar de etapa');
    } finally {
      setAccionando(null);
    }
  }

  if (loading) return <Spinner label="Cargando journeys..." />;

  if (!journeys.length && !error) {
    return (
      <EmptyState
        title="Aún no hay journeys sembrados"
        text="Vuelve luego de aplicar el seed inicial."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--m-accent-text)', fontSize: 13, fontFamily: 'var(--m-font-rounded)' }}>
          <span>{error}</span>
          <button className="m-btn-ghost" onClick={() => cargar()}>Reintentar</button>
        </div>
      )}

      {MONTANAS.map(({ key, label }) => {
        const grupo = journeys.filter((j) => j.montana === key);
        if (!grupo.length) return null;
        return (
          <div key={key}>
            <p className="m-montana-title">{label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grupo.map((j) => {
                const etapaActual = j.etapas.find((e) => e.orden === j.etapa_actual);
                const progreso = j.progresoEtapa;
                const pct = progreso ? Math.max(0, Math.min(100, Math.round(progreso.progreso * 100))) : 0;
                const carta = etapaActual ? cartasPorId.get(etapaActual.contenido_slug) : undefined;
                const enAccion = accionando === j.slug || accionando === j.id;
                const aviso = avisoAvance[j.id];

                return (
                  <div key={j.id} className="m-journey-card" style={{ opacity: j.estado === 'bloqueado' ? 0.65 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--m-fg)', fontFamily: 'var(--m-font-rounded)' }}>{j.nombre}</span>
                          <Badge estado={j.estado} />
                        </div>
                        {j.descripcion && (
                          <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '6px 0 0', maxWidth: 560 }}>{j.descripcion}</p>
                        )}
                      </div>
                      {j.estado === 'disponible' && (
                        <button className="m-btn" disabled={enAccion} onClick={() => iniciar(j.slug)}>
                          {enAccion ? 'Iniciando...' : '▶ Iniciar'}
                        </button>
                      )}
                    </div>

                    {j.estado === 'en_curso' && etapaActual && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--m-line)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-fg)' }}>
                            Etapa {j.etapa_actual} de {j.etapas.length}: {etapaActual.nombre}
                          </span>
                          {progreso && (
                            <span style={{ fontSize: 11, fontFamily: 'var(--m-font-rounded)', color: 'var(--m-fg)' }}>
                              {progreso.hechos} / {progreso.meta}
                            </span>
                          )}
                        </div>

                        {progreso && (
                          <div className="m-bar" style={{ margin: '8px 0 10px' }}>
                            <div className="m-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                        )}

                        {carta && (
                          <div style={{ background: 'var(--m-surface-2)', border: 'none', boxShadow: 'var(--m-shadow-sm)', borderRadius: 16, padding: '10px 12px', margin: '4px 0 10px' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-fg)', margin: '0 0 4px', fontFamily: 'var(--m-font-rounded)' }}>{carta.title}</p>
                            <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '0 0 6px' }}>{carta.resumen}</p>
                            <a href={`#carta-${carta.id}`} style={{ fontSize: 13, color: 'var(--m-fg)', textDecoration: 'none', fontWeight: 700, fontFamily: 'var(--m-font-rounded)' }}>
                              Leer carta completa ↓
                            </a>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            className="m-btn"
                            disabled={!progreso?.cumplida || enAccion}
                            onClick={() => avanzar(j.id)}
                          >
                            {enAccion ? 'Avanzando...' : 'Avanzar de etapa'}
                          </button>
                          {!progreso?.cumplida && (
                            <span style={{ fontSize: 13, color: 'var(--m-muted)', fontFamily: 'var(--m-font-rounded)' }}>
                              {aviso || `Te faltan ${Math.max(0, (progreso?.meta ?? 0) - (progreso?.hechos ?? 0))} checks.`}
                            </span>
                          )}
                        </div>

                        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {j.etapas.map((e) => (
                            <li key={e.id} style={{ fontSize: 13, fontFamily: 'var(--m-font-rounded)', color: e.completada_at ? 'var(--m-fg)' : 'var(--m-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Etapa completada = hecho, no celebración: champagne, nunca teal (--m-ok). */}
                              <span style={{ color: e.completada_at ? 'var(--m-champagne)' : 'var(--m-muted)' }}>{e.completada_at ? '✓' : '○'}</span>
                              {e.orden}. {e.nombre}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {j.estado === 'completado' && (
                      <p style={{ fontSize: 13, color: 'var(--m-champagne)', margin: '10px 0 0', fontFamily: 'var(--m-font-rounded)' }}>
                        {j.etapas.length} etapa{j.etapas.length === 1 ? '' : 's'} completadas.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
