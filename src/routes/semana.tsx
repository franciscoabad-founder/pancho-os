// Pagina /semana portada de src/pages/semana.astro a TanStack Start.
//
// OSSemana ya habla con /api/semana (server route ya portada en
// src/routes/api/semana.ts), asi que esta pagina solo lo envuelve con el layout
// y el header. Titulo, eyebrow y subtitulo se copian literales del .astro.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSSemana from '../os/components/OSSemana.tsx';

export const Route = createFileRoute('/semana')({
  head: () => ({ meta: [{ title: tituloOs('Semana') }] }),
  component: SemanaPage,
});

function SemanaPage() {
  return (
    <OSLayout title="Semana">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Control · Semana"
          title="Semana"
          subtitle="El día lleva el modo (Maker o Manager) y el bloque lleva la función. La cara de cada bloque se deriva del cruce: el mismo bloque de vender propone reuniones y CRM en un día Manager, y propuestas y decks en un día Maker. El balance se cuadra por semana, no por día."
        />
        <OSSemana />
      </div>
    </OSLayout>
  );
}
