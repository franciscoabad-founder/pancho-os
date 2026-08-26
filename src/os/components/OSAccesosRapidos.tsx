// Accesos rapidos de Hoy: grilla compacta a los modulos que se abren seguido,
// marcando cuales todavia no estan configurados.
//
// Antes Hoy tenia una sola card ancha a Salud y nada mas, asi que desde la home
// no se veia que Juego (o la propia Salud) seguian sin onboarding.
//
// No monta los flujos de onboarding: cada modulo ya tiene su propio banner
// (OSOnboardingBanner) en su pagina. Aca solo se marca el pendiente y se lleva
// hasta alla, para no duplicar la logica de prefill de cada flujo.
//
// El modulo 'os' queda fuera a proposito: su onboarding es OSOnboarding, que ya
// se renderiza arriba en esta misma pagina.
import { useEffect, useState } from 'react';

interface Acceso {
  href: string;
  label: string;
  icono: string;
  /** modulo de onboarding_estado, si este acceso tiene onboarding propio */
  modulo?: 'salud' | 'juego';
}

const ACCESOS: Acceso[] = [
  { href: '/salud', label: 'Salud', icono: 'favorite', modulo: 'salud' },
  { href: '/juego', label: 'Juego', icono: 'sports_esports', modulo: 'juego' },
  { href: '/finanzas', label: 'Finanzas', icono: 'payments' },
  { href: '/tareas', label: 'Tareas', icono: 'checklist' },
  { href: '/diario', label: 'Journal', icono: 'auto_stories' },
  { href: '/cerebro', label: 'Cerebro', icono: 'psychology' },
];

const CON_ONBOARDING = ACCESOS.filter((a) => a.modulo).map((a) => a.modulo!);

export default function OSAccesosRapidos() {
  // null mientras no se sabe: no se marca nada como pendiente hasta confirmarlo,
  // para no acusar de "sin configurar" un modulo que si lo esta.
  const [pendientes, setPendientes] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const estados = await Promise.all(
          CON_ONBOARDING.map(async (modulo) => {
            const res = await fetch(`/api/onboarding?modulo=${modulo}`, { cache: 'no-store' });
            const data = await res.json();
            return { modulo, completado: !!data?.estado?.completado_at };
          }),
        );
        if (cancelado) return;
        setPendientes(new Set(estados.filter((e) => !e.completado).map((e) => e.modulo)));
      } catch {
        // Si no se puede saber, no se marca nada. Los accesos siguen sirviendo.
        if (!cancelado) setPendientes(new Set());
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="os-card" style={{ marginBottom: '1rem' }}>
      <p className="os-section-title">Accesos rapidos</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
        gap: 8,
      }}>
        {ACCESOS.map((a) => {
          const pendiente = a.modulo ? pendientes?.has(a.modulo) : false;
          return (
            <a
              key={a.href}
              href={a.href}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '0.75rem 0.5rem', borderRadius: 8, textDecoration: 'none',
                background: 'var(--os-fill-subtle)',
                border: `1px solid ${pendiente ? 'var(--os-line-accent)' : 'var(--os-line-soft)'}`,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: pendiente ? 'var(--os-accent-light)' : 'var(--os-muted)' }}
              >
                {a.icono}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--os-text)' }}>{a.label}</span>
              {pendiente && (
                <span style={{
                  fontSize: 10, fontFamily: 'var(--os-font-display)', letterSpacing: '0.04em',
                  textTransform: 'uppercase', color: 'var(--os-accent-light)',
                }}>
                  sin configurar
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
