// Pagina /bandeja portada de src/pages/bandeja.astro a TanStack Start.
//
// El componente OSBandeja ya habla con /api/bandeja; esta pagina solo lo
// envuelve con el layout y el header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSBandeja from '../os/components/OSBandeja.tsx';

export const Route = createFileRoute('/bandeja')({
  head: () => ({ meta: [{ title: tituloOs('Por revisar') }] }),
  component: BandejaPage,
});

function BandejaPage() {
  return (
    <OSLayout title="Por revisar">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Por revisar"
          subtitle="Articulos, links y decisiones capturadas para revisar despues."
        />
        <OSBandeja />
      </div>
    </OSLayout>
  );
}
