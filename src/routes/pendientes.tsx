// Pagina /pendientes portada de src/pages/pendientes.astro a TanStack Start.
//
// OSPendientes habla con /api/pendientes (portada en
// src/routes/api/pendientes.ts).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSPendientes from '../os/components/OSPendientes.tsx';

export const Route = createFileRoute('/pendientes')({
  head: () => ({ meta: [{ title: tituloOs('Pendientes') }] }),
  component: PendientesPage,
});

function PendientesPage() {
  return (
    <OSLayout title="Pendientes">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Pendientes"
          subtitle="Intenciones sin fecha comprometida. Cuando decides actuar, conviertelas a tarea."
        />
        <OSPendientes />
      </div>
    </OSLayout>
  );
}
