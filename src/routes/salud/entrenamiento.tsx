// Pagina /salud/entrenamiento portada de src/pages/salud/entrenamiento.astro.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludEntrenamiento from '../../os/components/salud/OSSaludEntrenamiento.tsx';

export const Route = createFileRoute('/salud/entrenamiento')({
  head: () => ({ meta: [{ title: tituloOs('Entrenamiento') }] }),
  component: EntrenamientoPage,
});

function EntrenamientoPage() {
  return (
    <OSLayout title="Entrenamiento">
      <div className="os-fade-up">
        <PageHeader eyebrow="Salud · Entrenamiento" title="Entrenamiento" />
        <OSSaludNav activo="entrenamiento" />
        <OSSaludEntrenamiento />
      </div>
    </OSLayout>
  );
}
