// Pagina /diario: la bitacora de dias y procesos. El componente OSDiario habla
// con /api/journal; esta pagina solo lo envuelve con el layout y el header.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSDiario from '../os/components/OSDiario.tsx';

export const Route = createFileRoute('/diario')({
  head: () => ({ meta: [{ title: tituloOs('Diario') }] }),
  component: DiarioPage,
});

function DiarioPage() {
  return (
    <OSLayout title="Diario">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Diario"
          subtitle="Documenta el dia y los procesos. Escribe desde el OS, desde Hermes o dictando. Marca lo publicable, mandalo a contenido y sincroniza el dia al brain."
        />
        <OSDiario />
      </div>
    </OSLayout>
  );
}
