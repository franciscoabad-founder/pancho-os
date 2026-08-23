// Pagina /proyectos portada de src/pages/proyectos.astro a TanStack Start.
//
// OSProyectos ya trae sus propios datos por fetch; esta pagina solo lo envuelve
// con el layout y el header, con el mismo copy del .astro.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSProyectos from '../os/components/OSProyectos.tsx';

export const Route = createFileRoute('/proyectos')({
  head: () => ({ meta: [{ title: tituloOs('Proyectos') }] }),
  component: ProyectosPage,
});

function ProyectosPage() {
  return (
    <OSLayout title="Proyectos">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Proyectos"
          subtitle="El Project Stack ordena por prioridad, no por orden de llegada. Un proyecto pausado no recibe atencion a proposito: esa es la funcion del stack."
        />
        <OSProyectos />
      </div>
    </OSLayout>
  );
}
