// Pagina /contenido portada de src/pages/contenido.astro a TanStack Start.
//
// El componente OSContenido ya habla con /api/contenido (server route de
// TanStack), asi que esta pagina es solo envoltorio: layout, header y tabs.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSContenido from '../organs/contenido/ui/OSContenido.tsx';
import ContenidoNav from '../organs/contenido/ui/ContenidoNav.tsx';

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

        <ContenidoNav />

        <OSContenido />
      </div>
    </OSLayout>
  );
}
