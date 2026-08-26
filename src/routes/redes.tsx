// La protección la pone el middleware global (src/server/osAuthMiddleware.ts).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSContenidoEditor from '../organs/contenido/ui/OSContenidoEditor.tsx';
import RedesMetricas from '../organs/contenido/ui/RedesMetricas.tsx';

export const Route = createFileRoute('/redes')({
  head: () => ({ meta: [{ title: tituloOs('Redes') }] }),
  component: RedesPage,
});

function RedesPage() {
  return (
    <OSLayout title="Redes">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Distribucion"
          title="Redes y Contenido"
          subtitle="Borradores con guardado real: lo que escribas sobrevive al refresco."
        />
        <RedesMetricas />
        <OSContenidoEditor />
      </div>
    </OSLayout>
  );
}
