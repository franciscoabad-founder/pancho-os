// Pagina /salud/nutricion portada de src/pages/salud/nutricion.astro.
// Es tambien el destino del redirect 301 de /comidas (ver src/routes/comidas.tsx).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludNutricion from '../../os/components/salud/OSSaludNutricion.tsx';

export const Route = createFileRoute('/salud/nutricion')({
  head: () => ({ meta: [{ title: tituloOs('Nutrición') }] }),
  component: NutricionPage,
});

function NutricionPage() {
  return (
    <OSLayout title="Nutrición">
      <div className="os-fade-up">
        <PageHeader eyebrow="Salud · Nutrición" title="Nutrición" />
        <OSSaludNav activo="nutricion" />
        <OSSaludNutricion />
      </div>
    </OSLayout>
  );
}
