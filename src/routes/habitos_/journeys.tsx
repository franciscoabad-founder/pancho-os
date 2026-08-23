// Pagina /habitos/journeys portada de src/pages/habitos/journeys.astro a
// TanStack Start.
//
// Por que el directorio se llama `habitos_` y no `habitos`: en el enrutado por
// archivos de TanStack, `habitos/journeys.tsx` junto a `habitos.tsx` convierte a
// /habitos en LAYOUT de /habitos/journeys, y como la pagina de Habitos no
// renderiza <Outlet /> (no lo hacia en Astro, son dos paginas hermanas), la ruta
// hija no se veria nunca. El sufijo `_` desanida sin cambiar la URL, que sigue
// siendo /habitos/journeys.
//
// QUE NO SE PORTO, y por que: el .astro leia una coleccion de contenido
// (`getCollection('journeys')`, MDX en src/content/journeys/**) para renderizar
// las cartas completas dentro de <details id="carta-<id>">, mas un <script> que
// abria el <details> al llegar por el anchor #carta-<id>. Esa coleccion NUNCA
// existio en este repositorio: no hay src/content/, ni un solo .mdx, ni
// content.config.ts, ni en el arbol de trabajo ni en el historial de git. Con lo
// cual `entradas` siempre era [], el bloque de cartas nunca se renderizaba y el
// script no tenia a que apuntar. Se porta el comportamiento real (cartas=[]), no
// el codigo muerto. Si algun dia entra contenido de journeys al repo, va como
// datos servidos por un loader de esta ruta, no como coleccion de Astro (que ya
// no es dependencia del proyecto).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import OSJourneys from '../../os/components/OSJourneys.tsx';
import conductualCss from '../../styles/os-conductual.css?url';

export const Route = createFileRoute('/habitos_/journeys')({
  head: () => ({
    meta: [{ title: tituloOs('Journeys') }],
    links: [{ rel: 'stylesheet', href: conductualCss }],
  }),
  component: JourneysPage,
});

function JourneysPage() {
  return (
    <OSLayout title="Journeys">
      <div className="os-fade-up" data-modulo="habitos">
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: '1rem', position: 'relative', zIndex: 2,
          }}
        >
          <div>
            <p className="m-eyebrow">Hábitos // Journeys</p>
            <h1 className="m-h1">Journeys</h1>
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
          <OSJourneys cartas={[]} />
        </div>
      </div>
    </OSLayout>
  );
}
