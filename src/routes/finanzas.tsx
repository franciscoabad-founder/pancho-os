// Pagina /finanzas portada de src/pages/finanzas.astro a TanStack Start.
//
// El .astro no tenia componente: era markup inline mas un <script is:inline>.
// Todo eso vive ahora en src/os/components/OSFinanzas.tsx, incluido el header
// propio de la pagina (no usa PageHeader porque el original no lleva eyebrow
// con acciones, y respetamos su copy exacto).
//
// La proteccion la pone el middleware global (src/server/osAuthMiddleware.ts).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSFinanzas from '../os/components/OSFinanzas.tsx';

export const Route = createFileRoute('/finanzas')({
  head: () => ({ meta: [{ title: tituloOs('Finanzas') }] }),
  component: FinanzasPage,
});

function FinanzasPage() {
  return (
    <OSLayout title="Finanzas">
      <div className="os-fade-up">
        <OSFinanzas />
      </div>
    </OSLayout>
  );
}
