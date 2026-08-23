// Pagina /salud/sueno portada de src/pages/salud/sueno.astro a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludSueno from '../../os/components/salud/OSSaludSueno.tsx';

export const Route = createFileRoute('/salud/sueno')({
  head: () => ({ meta: [{ title: tituloOs('Sueño') }] }),
  component: SuenoPage,
});

function SuenoPage() {
  return (
    <OSLayout title="Sueño">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Salud · Sueño"
          title="Sueño"
          subtitle="Modelo de dos procesos: deuda, ventanas y plan"
        />
        <OSSaludNav activo="sueno" />
        <OSSaludSueno />
      </div>
    </OSLayout>
  );
}
