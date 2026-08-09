import { useEffect, useState } from 'react';
import { useConfirm } from './ui';

// Checklist de diarias (habitos) en el HOME del OS. Trae data real desde
// /api/os/habitos, a diferencia de OSChecklist (estatico por props, daily.astro).
// Vive fuera de [data-modulo="habitos"], asi que usa tokens --os-* (Ultramarine v5),
// no los tokens --m-* del canon conductual brutalista.
// Regla de color: hecho/completado = champagne, accion = accent, nunca verde.

interface HabitoDiaria {
  id: string;
  nombre: string;
  tipo: 'habito' | 'diaria';
  hecho_hoy: boolean | null;
  es_core: boolean;
}
interface CheckResponse {
  ok?: boolean;
  xp?: number;
  error?: string;
}

interface Props {
  title?: string;
}

const TZ = 'America/Guayaquil';
function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

export default function OSChecklistHoy({ title }: Props) {
  const { confirm, sheet } = useConfirm();
  const [habitos, setHabitos] = useState<HabitoDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [xpFlash, setXpFlash] = useState<{ id: string; xp: number } | null>(null);
  const [enviando, setEnviando] = useState<Set<string>>(new Set());

  async function cargar(mostrarLoading = true) {
    if (mostrarLoading) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/os/habitos?vista=hoy');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const diarias: HabitoDiaria[] = (data.habitos ?? []).filter(
        (h: HabitoDiaria) => h.tipo === 'diaria',
      );
      setHabitos(diarias);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      if (mostrarLoading) setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function toggle(h: HabitoDiaria) {
    if (enviando.has(h.id)) return;
    setEnviando((cur) => new Set(cur).add(h.id));
    try {
      if (h.hecho_hoy) {
        if (!(await confirm({
          title: 'Deshacer check',
          text: 'Se quita el registro de hoy para este habito.',
          confirmLabel: 'Deshacer',
          danger: true,
        }))) return;
        try {
          const res = await fetch(`/api/os/habitos/checks?habito_id=${h.id}&fecha=${hoyISO()}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('No se pudo deshacer');
          await cargar(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Error');
        }
        return;
      }

      try {
        const res = await fetch('/api/os/habitos/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habito_id: h.id }),
        });
        const data: CheckResponse = await res.json();
        if (res.status === 409) {
          await cargar(false);
          return;
        }
        if (data.error) throw new Error(data.error);
        if (data.xp) {
          setXpFlash({ id: h.id, xp: data.xp });
          setTimeout(() => setXpFlash((cur) => (cur?.id === h.id ? null : cur)), 1500);
          window.dispatchEvent(new CustomEvent('os:xp', { detail: { xp: data.xp } }));
        }
        await cargar(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al registrar');
      }
    } finally {
      setEnviando((cur) => {
        const next = new Set(cur);
        next.delete(h.id);
        return next;
      });
    }
  }

  const done = habitos.filter((h) => h.hecho_hoy).length;

  return (
    <div>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <p style={{ fontFamily: 'var(--os-font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--os-muted)', margin: 0 }}>
            {title}
          </p>
          {!loading && !error && habitos.length > 0 && (
            <span style={{ fontSize: 'var(--os-text-xs)', color: done === habitos.length ? 'var(--os-champagne)' : 'var(--os-muted)' }}>
              {done}/{habitos.length}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              style={{
                height: '36px',
                borderRadius: '6px',
                background: 'var(--os-fill-subtle)',
                opacity: 0.4 + i * 0.15,
                animation: 'os-checklist-pulse 1.2s ease-in-out infinite',
              }}
            />
          ))}
        </ul>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--os-text-sm)', color: 'var(--os-error)' }}>
          <span>{error}</span>
          <button
            onClick={() => cargar()}
            style={{
              background: 'transparent', color: 'var(--os-text-2)', border: '1px solid var(--os-line)',
              borderRadius: 6, padding: '3px 10px', minHeight: 36, fontSize: 'var(--os-text-xs)', cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      ) : habitos.length === 0 ? (
        <p style={{ fontSize: 'var(--os-text-sm)', color: 'var(--os-muted)', margin: 0, lineHeight: 1.5 }}>
          Sin diarias para hoy. <a href="/os/habitos" style={{ color: 'var(--os-accent-light)' }}>Configura tus hábitos.</a>
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {habitos.map((h) => {
            const completado = !!h.hecho_hoy;
            const enVuelo = enviando.has(h.id);
            return (
              <li key={h.id}>
                <button
                  onClick={() => toggle(h)}
                  disabled={enVuelo}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    width: '100%', border: 'none', cursor: enVuelo ? 'not-allowed' : 'pointer',
                    padding: '8px 10px', minHeight: 36, borderRadius: '6px', textAlign: 'left',
                    background: completado ? 'rgba(181,152,90,0.10)' : 'var(--os-fill-subtle)',
                    opacity: enVuelo ? 0.5 : 1,
                    transition: 'background 0.16s',
                  }}
                >
                  <span
                    style={{
                      width: '17px', height: '17px', flexShrink: 0, borderRadius: '4px', marginTop: '1px',
                      border: completado ? '2px solid var(--os-champagne)' : '2px solid var(--os-line)',
                      background: completado ? 'var(--os-champagne)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.16s',
                    }}
                  >
                    {completado && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <polyline points="1,3.5 3.5,6 8,1" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--os-text-base)',
                      color: completado ? 'var(--os-muted)' : 'var(--os-text)',
                      textDecoration: completado ? 'line-through' : 'none',
                      transition: 'color 0.16s',
                      lineHeight: 1.45,
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {h.nombre}
                    {h.es_core && (
                      <span
                        title="core"
                        style={{
                          width: '5px', height: '5px', borderRadius: '50%',
                          background: 'var(--os-accent)', flexShrink: 0, display: 'inline-block',
                        }}
                      />
                    )}
                  </span>
                  {xpFlash?.id === h.id && (
                    <span
                      style={{
                        fontSize: 'var(--os-text-xs)', fontWeight: 700, color: 'var(--os-champagne)',
                        flexShrink: 0, alignSelf: 'center',
                      }}
                    >
                      +{xpFlash.xp} XP
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: '0.625rem', textAlign: 'right' }}>
        <a href="/os/habitos" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)', textDecoration: 'none' }}>
          Gestionar hábitos →
        </a>
      </div>

      <style>{`
        @keyframes os-checklist-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
      `}</style>
      {sheet}
    </div>
  );
}
