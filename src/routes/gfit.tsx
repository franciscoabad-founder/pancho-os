// Pagina /gfit portada de src/pages/gfit.astro a TanStack Start.
//
// El componente OSGfit ya habla con /api/gfit/* (server routes de TanStack), asi
// que esta pagina es solo envoltorio: layout y header.
//
// Sobre `?tab=`: OSGfit resuelve su pestana inicial leyendo
// window.location.search en el primer render (deep-link /gfit?tab=progreso desde
// el nav de Salud). El search de TanStack se declara aca con validateSearch para
// que el router lo conserve tal cual en la URL en vez de descartarlo por no estar
// en el esquema, que dejaria el deep-link muerto.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSGfit from '../os/components/gfit/OSGfit.tsx';

type GfitSearch = { tab?: 'planes' | 'biblioteca' | 'progreso' };

export const Route = createFileRoute('/gfit')({
  validateSearch: (search: Record<string, unknown>): GfitSearch => {
    const tab = search.tab;
    if (tab === 'planes' || tab === 'biblioteca' || tab === 'progreso') return { tab };
    return {};
  },
  head: () => ({ meta: [{ title: tituloOs('GFIT') }] }),
  component: GfitPage,
});

function GfitPage() {
  return (
    <OSLayout title="GFIT">
      <div className="os-fade-up">
        <div style={{ marginBottom: '1rem' }}>
          <p className="os-eyebrow" style={{ marginBottom: 6 }}>Vida · GFIT</p>
          <h1 className="os-h1">GFIT</h1>
        </div>
        <OSGfit />
      </div>
    </OSLayout>
  );
}
