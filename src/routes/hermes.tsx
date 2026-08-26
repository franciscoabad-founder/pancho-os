// Pagina /hermes: Cockpit operativo para Hermes en Pancho OS.
// Reemplaza a la app de escritorio y centraliza perfiles, modelos,
// dictado por voz y sesiones de Telegram / OS.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSHermesCockpit from '../os/components/OSHermesCockpit.tsx';

export const Route = createFileRoute('/hermes')({
  head: () => ({ meta: [{ title: tituloOs('Hermes Cockpit') }] }),
  component: HermesPage,
});

function HermesPage() {
  return (
    <OSLayout title="Hermes Cockpit">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Operacion Agente"
          title="Hermes Cockpit"
          subtitle="Centro de control del agente. Alterna perfiles (VPS, HomeLab, Laptop), cambia modelos en caliente, dicta ordenes y opera sesiones de Telegram y del OS."
        />
        <OSHermesCockpit />
      </div>
    </OSLayout>
  );
}
