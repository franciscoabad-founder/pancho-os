// Pagina /salud portada de src/pages/salud/index.astro a TanStack Start.
//
// Archivo salud/index.tsx y no salud.tsx: con index el directorio queda como
// puro segmento de ruta y /salud sale como hoja hermana de /salud/ayuno,
// /salud/cuerpo, etc. Un salud.tsx al lado del directorio convertiria el
// dashboard en layout de todas las subpaginas, que no es lo que hacia Astro.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';
import OSSaludNav from '../../os/components/salud/OSSaludNav.tsx';
import OSSaludDashboard from '../../os/components/salud/OSSaludDashboard.tsx';
import OSOnboardingBanner from '../../os/components/onboarding/OSOnboardingBanner.tsx';

export const Route = createFileRoute('/salud/')({
  head: () => ({ meta: [{ title: tituloOs('Salud') }] }),
  component: SaludPage,
});

function SaludPage() {
  // La fecha se calcula en el render (no en el modulo) para que el valor sea el
  // del dia en que se pide la pagina y no el del arranque del proceso.
  const fecha = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const fechaLarga = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <OSLayout title="Salud">
      <div className="os-fade-up">
        <PageHeader eyebrow="Cuerpo" title="Salud" subtitle={fechaLarga} />
        <OSSaludNav activo="dashboard" />
        <OSOnboardingBanner modulo="salud" />
        <OSSaludDashboard />
      </div>
    </OSLayout>
  );
}
