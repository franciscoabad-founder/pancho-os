// Pagina /crm portada de src/pages/crm.astro a TanStack Start.
//
// El .astro no tenia componente: era markup inline mas un <script is:inline>.
// Todo eso vive ahora en src/os/components/OSCrm.tsx, incluido el header propio
// de la pagina (no usa PageHeader porque lleva el contador de leads y el
// conmutador kanban/tabla pegados al titulo, como en el original).
//
// La proteccion la pone el middleware global (src/server/osAuthMiddleware.ts).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSCrm from '../os/components/OSCrm.tsx';

export const Route = createFileRoute('/crm')({
  head: () => ({ meta: [{ title: tituloOs('CRM') }] }),
  component: CrmPage,
});

function CrmPage() {
  return (
    <OSLayout title="CRM">
      <div className="os-fade-up">
        <OSCrm />
      </div>
    </OSLayout>
  );
}
