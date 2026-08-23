// Pagina /kpis portada de src/pages/kpis.astro a TanStack Start.
//
// El componente OSKpis ya habla con /api/kpis; esta pagina solo lo envuelve con
// el layout, el header y la nota al pie sobre los numeros, que en el .astro era
// markup inline sin logica.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import OSKpis from '../os/components/OSKpis.tsx';

export const Route = createFileRoute('/kpis')({
  head: () => ({ meta: [{ title: tituloOs('KPIs') }] }),
  component: KpisPage,
});

function KpisPage() {
  return (
    <OSLayout title="KPIs">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Tablero"
          title="KPIs"
          subtitle="Metricas reales, registradas a mano o por API. Sin cifras inventadas."
        />

        <OSKpis />

        <div style={{ marginTop: '2rem' }}>
          <p className="os-section-title">Nota sobre los numeros</p>
          <div className="os-card-2 os-card-accent">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: 'var(--os-accent-light)', flexShrink: 0, marginTop: 1 }}
              >
                info
              </span>
              <p style={{ fontSize: 13, color: 'var(--os-text-2)', margin: 0, lineHeight: 1.6 }}>
                Los valores en <span style={{ color: 'var(--os-champagne)', fontWeight: 600 }}>champagne</span> son el
                ultimo valor registrado por KPI. Las tendencias comparan contra el registro anterior. Registra un valor
                nuevo desde cada tarjeta cuando tengas el numero real.
              </p>
            </div>
          </div>
        </div>
      </div>
    </OSLayout>
  );
}
