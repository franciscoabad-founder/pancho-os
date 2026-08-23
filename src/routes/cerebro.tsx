// Pagina /cerebro portada de src/pages/cerebro.astro a TanStack Start.
//
// El .astro traia el header, el buscador, la grilla de notas y el modal como
// HTML plano mas dos <script is:inline> que los manejaban con innerHTML. Todo
// eso vive ahora en src/os/components/OSCerebro.tsx, que ademas monta el grafo
// (OSGraphBrain). Esta pagina queda como envoltorio del layout.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSCerebro from '../os/components/OSCerebro.tsx';

export const Route = createFileRoute('/cerebro')({
  head: () => ({ meta: [{ title: tituloOs('Cerebro') }] }),
  component: CerebroPage,
});

function CerebroPage() {
  return (
    <OSLayout title="Cerebro">
      <OSCerebro />
    </OSLayout>
  );
}
