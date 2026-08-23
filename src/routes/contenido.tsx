// Pagina /contenido portada de src/pages/contenido.astro a TanStack Start.
//
// El componente OSContenido ya habla con /api/contenido (server route de
// TanStack), asi que esta pagina es solo envoltorio: layout, header y tabs.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSContenido from '../organs/contenido/ui/OSContenido.tsx';

export const Route = createFileRoute('/contenido')({
  head: () => ({ meta: [{ title: tituloOs('Contenido') }] }),
  component: ContenidoPage,
});

function ContenidoPage() {
  return (
    <OSLayout title="Contenido">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Pipeline editorial"
          title="Contenido"
          subtitle="Ideas, produccion y repurposing en un solo pipeline."
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          <a
            href="/contenido"
            className="os-pill os-pill-accent"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: '1px solid var(--os-line)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_note</span>
            Pipeline
          </a>
          <a
            href="/os/contenido/planner"
            className="os-pill"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: '1px solid var(--os-line)', color: 'var(--os-muted)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_view_week</span>
            Planner
          </a>
          <a
            href="/os/contenido/radar"
            className="os-pill"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: '1px solid var(--os-line)', color: 'var(--os-muted)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>radar</span>
            Radar
          </a>
        </div>

        <OSContenido />
      </div>
    </OSLayout>
  );
}
