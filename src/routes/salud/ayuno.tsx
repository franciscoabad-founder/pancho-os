// Pagina /salud/ayuno portada de src/pages/salud/ayuno.astro a TanStack Start.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludAyuno from '../../os/components/salud/OSSaludAyuno.tsx';

export const Route = createFileRoute('/salud/ayuno')({
  head: () => ({ meta: [{ title: tituloOs('Ayuno') }] }),
  component: AyunoPage,
});

function AyunoPage() {
  return (
    <OSLayout title="Ayuno">
      <div className="os-fade-up">
        <PageHeader eyebrow="Salud · Ayuno" title="Ayuno" />
        <OSSaludNav activo="ayuno" />
        <OSSaludAyuno />
      </div>
    </OSLayout>
  );
}
