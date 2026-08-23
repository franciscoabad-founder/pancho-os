// Pagina /recordatorios portada de src/pages/recordatorios.astro a TanStack
// Start.
//
// OSRecordatorios habla con /api/recordatorios (portada en
// src/routes/api/recordatorios.ts).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSRecordatorios from '../os/components/OSRecordatorios.tsx';

export const Route = createFileRoute('/recordatorios')({
  head: () => ({ meta: [{ title: tituloOs('Recordatorios') }] }),
  component: RecordatoriosPage,
});

function RecordatoriosPage() {
  return (
    <OSLayout title="Recordatorios">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Recordatorios"
          subtitle="Avisos con fecha que Hermes empuja al celular. No son tareas operativas."
        />
        <OSRecordatorios />
      </div>
    </OSLayout>
  );
}
