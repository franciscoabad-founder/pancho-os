// Pagina /grabar portada de src/pages/grabar.astro a TanStack Start.
//
// El componente OSGrabar ya habla con /api/grabaciones (server route de
// TanStack), asi que esta pagina es solo envoltorio: layout y header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSGrabar from '../os/components/OSGrabar.tsx';

export const Route = createFileRoute('/grabar')({
  head: () => ({ meta: [{ title: tituloOs('Grabar') }] }),
  component: GrabarPage,
});

function GrabarPage() {
  return (
    <OSLayout title="Grabar">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Grabar"
          subtitle="Graba reuniones o notas de voz. El audio se transcribe, se resume y queda guardado en el cerebro con el proyecto que elijas."
        />
        <OSGrabar />
      </div>
    </OSLayout>
  );
}
