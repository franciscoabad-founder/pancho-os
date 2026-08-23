// Pagina /os/contenido/planner portada de src/pages/os/contenido/planner.astro
// a TanStack Start.
//
// El componente OSContentPlanner ya habla con su propia API, asi que esta
// pagina es solo envoltorio: layout, header y el ajuste responsive que el
// .astro declaraba con `<style is:global>`.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../../os/components/OSLayout.tsx';
import PageHeader from '../../../os/components/ui/PageHeader.tsx';
import OSContentPlanner from '../../../organs/contenido/ui/OSContentPlanner.tsx';

// Era `<style is:global>` en el .astro. Aca va como <style> plano: el shell del
// OS ya inyecta su CSS de la misma forma (ver OSLayout.tsx), y estas reglas son
// globales por definicion porque apuntan a una clase del sistema de diseno.
const cssPlanner = `
  @media (max-width: 820px) {
    .os-card-2 { padding: 1rem; }
  }
`;

export const Route = createFileRoute('/os/contenido/planner')({
  head: () => ({ meta: [{ title: tituloOs('Content Planner') }] }),
  component: PlannerPage,
});

function PlannerPage() {
  return (
    <OSLayout title="Content Planner">
      <style dangerouslySetInnerHTML={{ __html: cssPlanner }} />
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Escuchar, dar forma, publicar, aprender"
          title="Content Planner"
          subtitle="La semana de contenido: una historia padre, maximo tres piezas, y el veredicto al final."
        />
        <OSContentPlanner />
      </div>
    </OSLayout>
  );
}
