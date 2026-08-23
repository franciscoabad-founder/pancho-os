// /sistema en TanStack Start. Port PARCIAL y deliberado de src/pages/sistema.astro,
// mismo criterio que src/routes/redes.tsx.
//
// Que se porta aca: "Mis dispositivos", la isla nueva del pairing (Fase 2.1).
// Necesita una pagina alcanzable en la app nueva y /sistema es su casa: es la
// pantalla de la que ya cuelga el nav ("Mi Sistema") y donde vive todo lo que
// es configuracion del OS.
//
// Que NO se porta todavia: el editor del estado Cortex (OSSistema.tsx, el bloque
// de objetivos / priority stack / modulos / onboarding). Depende de /api/system,
// que sigue siendo un endpoint de Astro sin portar (src/pages/api/system.ts).
// Montarlo hoy seria pintar un formulario que no puede guardar. Le toca cuando
// se porte ese endpoint.
//
// La proteccion la pone el middleware global (src/server/osAuthMiddleware.ts):
// /sistema exige cookie de sesion y manda a /login si no la hay. No hace falta
// guard en la ruta.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSDispositivos from '../os/components/OSDispositivos.tsx';

export const Route = createFileRoute('/sistema')({
  head: () => ({ meta: [{ title: tituloOs('Mi Sistema') }] }),
  component: SistemaPage,
});

function SistemaPage() {
  return (
    <OSLayout title="Mi Sistema">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Mi Sistema"
          subtitle="Quien puede hablarle al OS, con que credencial y desde cuando."
        />
        <OSDispositivos />
      </div>
    </OSLayout>
  );
}
