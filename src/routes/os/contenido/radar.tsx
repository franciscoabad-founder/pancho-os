// Pagina /os/contenido/radar portada de src/pages/os/contenido/radar.astro a
// TanStack Start.
//
// El componente OSContentRadar ya habla con su propia API, asi que esta pagina
// es solo envoltorio: layout, header y el ajuste responsive que el .astro
// declaraba con `<style is:global>`.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../../os/components/OSLayout.tsx';
import PageHeader from '../../../os/components/ui/PageHeader.tsx';
import OSContentRadar from '../../../organs/contenido/ui/OSContentRadar.tsx';

// Ver el comentario equivalente en planner.tsx: era `<style is:global>`.
const cssRadar = `
  @media (max-width: 820px) {
    .os-card-2 { padding: 1rem; }
  }
`;

export const Route = createFileRoute('/os/contenido/radar')({
  head: () => ({ meta: [{ title: tituloOs('Content Radar') }] }),
  component: RadarPage,
});

function RadarPage() {
  return (
    <OSLayout title="Content Radar">
      <style dangerouslySetInnerHTML={{ __html: cssRadar }} />
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Investigacion de contenido"
          title="Content Radar"
          subtitle="Descubre oportunidades de contenido a partir de una palabra semilla."
        />
        <OSContentRadar />
      </div>
    </OSLayout>
  );
}
