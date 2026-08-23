// Home real del OS, portada de src/pages/index.astro a TanStack Start.
//
// Reemplaza el scaffold de TanStack Start por el dashboard "Hoy": onboarding,
// One Domino + Priority Stack + wins + discomfort + semana + objetivos
// (OSHoy), acceso a Salud, y el feed de notas del brain.

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSOnboarding from '../os/components/OSOnboarding.tsx';
import OSHoy from '../os/components/OSHoy.tsx';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: tituloOs('Hoy') }] }),
  component: HomePage,
});

function HomePage() {
  const fechaLarga = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <OSLayout title="Hoy">
      <div className="os-fade-up">
        <OSOnboarding />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem',
        }}>
          <div>
            <p className="os-eyebrow" style={{ marginBottom: 6 }}>Growth OS</p>
            <h1 className="os-h1">Hoy</h1>
          </div>
          <span style={{
            fontSize: 12, color: 'var(--os-muted)', textTransform: 'capitalize',
          }}>
            {fechaLarga}
          </span>
        </div>

        {/* Hoy: domino, priority stack, wins, checklist, discomfort, principios, semana, norte */}
        <OSHoy />

        {/* Salud */}
        <a
          href="/salud"
          className="os-card os-card-interactive"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1rem',
            textDecoration: 'none',
          }}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: 26, color: 'var(--os-accent-light)', flexShrink: 0,
          }}>
            favorite
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--os-text)', margin: 0 }}>
              Salud
            </p>
            <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: '2px 0 0' }}>
              Nutricion, ayuno, entrenamiento, cuerpo y estiramiento
            </p>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)' }}>
            chevron_right
          </span>
        </a>

        {/* Brain feed: notas REALES del brain (gbrain) via /api/brain/notes. */}
        <div className="os-card">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.875rem',
          }}>
            <p className="os-section-title" style={{ margin: 0 }}>Cerebro · ultimas notas</p>
            <a
              href="/cerebro"
              style={{
                fontSize: 11, color: 'var(--os-accent-light)', textDecoration: 'none',
                fontFamily: 'var(--os-font-display)', letterSpacing: '0.06em',
              }}
            >
              ver todo
            </a>
          </div>
          <BrainFeed />
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .os-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </OSLayout>
  );
}

interface NotaBrain {
  titulo?: string;
  excerpt?: string;
  resumen?: string;
}

function BrainFeed() {
  const [notas, setNotas] = useState<NotaBrain[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/brain/notes?limit=4')
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return;
        setNotas((d && d.notes) || []);
      })
      .catch(() => {
        if (cancelado) return;
        setError(true);
      });
    return () => { cancelado = true; };
  }, []);

  if (error) {
    return (
      <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>
        No se pudo cargar el cerebro.{" "}
        <a href="/cerebro" style={{ color: 'var(--os-accent-light)' }}>Abrir modulo</a>
      </p>
    );
  }

  if (notas === null) {
    return (
      <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>
        Cargando notas del cerebro...
      </p>
    );
  }

  if (!notas.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--os-muted)', margin: 0 }}>
        Sin notas todavia. Lo que guardes en el brain aparece aqui.
      </p>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8,
    }}>
      {notas.map((n, i) => (
        <a
          key={i}
          href="/cerebro"
          style={{
            display: 'block', padding: '0.875rem', borderRadius: 8,
            background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)',
            textDecoration: 'none',
          }}
        >
          <p style={{
            fontSize: 12, fontWeight: 600, color: 'var(--os-text)',
            margin: '0 0 0.375rem', lineHeight: 1.3,
          }}>
            {n.titulo || 'Sin titulo'}
          </p>
          <p style={{
            fontSize: 11, color: 'var(--os-muted)', margin: 0, lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {n.excerpt || n.resumen || ''}
          </p>
        </a>
      ))}
    </div>
  );
}
