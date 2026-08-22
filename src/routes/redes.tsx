// /redes en TanStack Start. Port PARCIAL y deliberado de src/pages/redes.astro.
//
// Que se porta aca: el editor de borradores, que es la pieza cuyo backend acaba
// de existir (os_contenido_ideas via /api/contenido). Sin esta ruta el arreglo
// del editor no seria alcanzable en la app nueva y no se podria hacer el smoke
// que pide el plan: escribir un borrador, refrescar, y verlo seguir ahi.
//
// Que NO se porta todavia: el bloque de metricas sociales de arriba (tarjetas
// por red y top posts). Depende de /api/redes-metricas, que sigue siendo un
// endpoint de Astro sin portar, y en el original vive como <script is:inline>
// con innerHTML a mano, que en un arbol React hay que reescribir como
// componente. Le toca cuando se porte ese endpoint; mientras tanto es mejor no
// pintar tarjetas vacias que nunca se van a llenar.
//
// La proteccion la pone el middleware global (src/server/osAuthMiddleware.ts):
// /redes exige cookie de sesion y manda a /login si no la hay. No hace falta
// guard en la ruta.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSContenidoEditor from '../organs/contenido/ui/OSContenidoEditor.tsx';

export const Route = createFileRoute('/redes')({
  head: () => ({ meta: [{ title: tituloOs('Redes') }] }),
  component: RedesPage,
});

function RedesPage() {
  return (
    <OSLayout title="Redes">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Distribucion"
          title="Redes y Contenido"
          subtitle="Borradores con guardado real: lo que escribas sobrevive al refresco."
        />
        <OSContenidoEditor />
      </div>
    </OSLayout>
  );
}
