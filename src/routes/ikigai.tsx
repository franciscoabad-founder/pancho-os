// Pagina /ikigai. El componente OSIkigai habla con /api/ikigai; esta pagina
// solo lo envuelve con el layout y el header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSIkigai from '../os/components/OSIkigai.tsx';

export const Route = createFileRoute('/ikigai')({
  head: () => ({ meta: [{ title: tituloOs('Ikigai') }] }),
  component: IkigaiPage,
});

function IkigaiPage() {
  return (
    <OSLayout title="Ikigai">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Ikigai"
          subtitle="Proposito antes que ejecucion. El diagrama clasico, versionable: rehazlo cada 3-6 meses y compara la deriva."
        />
        <OSIkigai />
      </div>
    </OSLayout>
  );
}
