// Pagina /revision portada de src/pages/revision.astro a TanStack Start.
//
// OSRevision habla con /api/revision (portada en src/routes/api/revision.ts).
// El <style is:global> del .astro se conserva tal cual: OSRevision pinta la
// grilla .os-2col y sin esa regla el movil queda con dos columnas apretadas.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSRevision from '../os/components/OSRevision.tsx';

const css = `
  @media (max-width: 820px) {
    .os-2col { grid-template-columns: 1fr !important; }
  }
`;

export const Route = createFileRoute('/revision')({
  head: () => ({ meta: [{ title: tituloOs('Week Review') }] }),
  component: RevisionPage,
});

function RevisionPage() {
  return (
    <OSLayout title="Week Review">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Retrospectiva"
          title="Week Review"
          subtitle="Weekly y monthly review, con el norte de 90 dias siempre a la vista."
        />
        <OSRevision />
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </OSLayout>
  );
}
