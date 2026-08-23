// Pagina /habitos portada de src/pages/habitos.astro a TanStack Start.
//
// El header NO usa PageHeader: esta pagina pertenece al sistema visual
// "conductual" (clases .m-*, tokens --m-*), no al del OS (.os-*), y mezclarlos
// romperia la tipografia y el color de acento del modulo. Se conserva el mismo
// markup inline del .astro.
//
// El CSS del modulo se declara como <link> desde `head` (mismo patron que
// src/routes/__root.tsx con os.css) en vez de un `import '...css'` a secas: asi
// la hoja entra en el HTML del servidor y no hay un parpadeo sin estilos
// mientras carga el chunk de JS de la ruta.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSHabitos from '../os/components/OSHabitos.tsx';
import conductualCss from '../styles/os-conductual.css?url';

const enlaceEstilo = {
  fontSize: 14,
  color: 'var(--m-accent)',
  textDecoration: 'none',
  fontFamily: 'var(--m-font-rounded)',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
};

export const Route = createFileRoute('/habitos')({
  head: () => ({
    meta: [{ title: tituloOs('Habitos') }],
    links: [{ rel: 'stylesheet', href: conductualCss }],
  }),
  component: HabitosPage,
});

function HabitosPage() {
  return (
    <OSLayout title="Hábitos">
      <div className="os-fade-up" data-modulo="habitos">
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: '1rem', position: 'relative', zIndex: 2,
          }}
        >
          <div>
            <p className="m-eyebrow">Sistema // Hábitos</p>
            <h1 className="m-h1">Hábitos</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a href="/juego" style={enlaceEstilo}>Juego →</a>
            <a href="/habitos/journeys" style={enlaceEstilo}>Ver journeys →</a>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <OSHabitos />
        </div>
      </div>
    </OSLayout>
  );
}
