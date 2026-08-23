// Pagina /notas portada de src/pages/notas.astro a TanStack Start.
//
// El componente OSNotas ya habla con /api/notas; esta pagina solo lo envuelve
// con el layout y el header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSNotas from '../os/components/OSNotas.tsx';

export const Route = createFileRoute('/notas')({
  head: () => ({ meta: [{ title: tituloOs('Notas') }] }),
  component: NotasPage,
});

function NotasPage() {
  return (
    <OSLayout title="Notas">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Notas"
          subtitle="Captura pensamientos sueltos. Conviertelos a pendiente, tarea o recordatorio cuando sepas que hacer con ellos."
        />
        <OSNotas />
      </div>
    </OSLayout>
  );
}
