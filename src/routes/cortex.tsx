// Pagina /cortex portada de src/pages/cortex.astro a TanStack Start.
//
// El .astro eran 475 lineas de plantilla mas dos <script is:inline>, sin
// componente. Todo eso vive ahora en src/os/components/OSCortex.tsx. Esta
// pagina queda como envoltorio del layout.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSCortex from '../os/components/OSCortex.tsx';

export const Route = createFileRoute('/cortex')({
  head: () => ({ meta: [{ title: tituloOs('Cortex') }] }),
  component: CortexPage,
});

function CortexPage() {
  return (
    <OSLayout title="Cortex">
      <OSCortex />
    </OSLayout>
  );
}
