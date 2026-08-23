// Pagina /salud/cuerpo portada de src/pages/salud/cuerpo.astro a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludCuerpo from '../../os/components/salud/OSSaludCuerpo.tsx';

export const Route = createFileRoute('/salud/cuerpo')({
  head: () => ({ meta: [{ title: tituloOs('Cuerpo') }] }),
  component: CuerpoPage,
});

function CuerpoPage() {
  return (
    <OSLayout title="Cuerpo">
      <div className="os-fade-up">
        <PageHeader eyebrow="Salud · Cuerpo" title="Cuerpo" />
        <OSSaludNav activo="cuerpo" />
        <OSSaludCuerpo />
      </div>
    </OSLayout>
  );
}
