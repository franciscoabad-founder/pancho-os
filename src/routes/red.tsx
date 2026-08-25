// Pagina /red (Networking Room en la UI). El componente OSRed habla con
// /api/red; esta pagina solo lo envuelve con el layout y el header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSRed from '../os/components/OSRed.tsx';

export const Route = createFileRoute('/red')({
  head: () => ({ meta: [{ title: tituloOs('Networking Room') }] }),
  component: RedPage,
});

function RedPage() {
  return (
    <OSLayout title="Networking Room">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Networking Room"
          subtitle="Diagnostico de red personal (Willburn): hasta 16 personas, apertura, diversidad y balance de vinculos. No es CRM de ventas."
        />
        <OSRed />
      </div>
    </OSLayout>
  );
}
