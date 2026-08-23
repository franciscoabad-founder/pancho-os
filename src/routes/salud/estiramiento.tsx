// Pagina /salud/estiramiento portada de src/pages/salud/estiramiento.astro.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludEstiramiento from '../../os/components/salud/OSSaludEstiramiento.tsx';

export const Route = createFileRoute('/salud/estiramiento')({
  head: () => ({ meta: [{ title: tituloOs('Estiramiento') }] }),
  component: EstiramientoPage,
});

function EstiramientoPage() {
  return (
    <OSLayout title="Estiramiento">
      <div className="os-fade-up">
        <PageHeader eyebrow="Salud · Estiramiento" title="Estiramiento" />
        <OSSaludNav activo="estiramiento" />
        <OSSaludEstiramiento />
      </div>
    </OSLayout>
  );
}
