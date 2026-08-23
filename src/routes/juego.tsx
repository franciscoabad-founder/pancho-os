// Pagina /juego portada de src/pages/juego.astro a TanStack Start.
//
// Mismas dos decisiones que /habitos: header con las clases .m-* del sistema
// conductual (no PageHeader, que es del sistema .os-*) y os-conductual.css
// declarado como <link> desde `head` para que llegue con el HTML del servidor.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSJuego from '../os/components/OSJuego.tsx';
import conductualCss from '../styles/os-conductual.css?url';

export const Route = createFileRoute('/juego')({
  head: () => ({
    meta: [{ title: tituloOs('Juego') }],
    links: [{ rel: 'stylesheet', href: conductualCss }],
  }),
  component: JuegoPage,
});

function JuegoPage() {
  return (
    <OSLayout title="Juego">
      <div className="os-fade-up" data-modulo="habitos">
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: '1rem', position: 'relative', zIndex: 2,
          }}
        >
          <div>
            <p className="m-eyebrow">Sistema // Juego</p>
            <h1 className="m-h1">Juego</h1>
          </div>
          <a
            href="/habitos"
            style={{
              fontSize: 14, color: 'var(--m-accent)', textDecoration: 'none',
              fontFamily: 'var(--m-font-rounded)', fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            ← Volver
          </a>
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <OSJuego />
        </div>
      </div>
    </OSLayout>
  );
}
