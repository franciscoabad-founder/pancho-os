// Pagina piloto de la migracion: /tareas end-to-end sobre TanStack Start, con
// datos reales de Supabase. Portada de src/pages/tareas.astro.
//
// Es la prueba de que las cuatro piezas encajan:
//   1. Proteccion: el middleware global (src/server/osAuthMiddleware.ts) exige
//      cookie de sesion para /tareas y manda a /login si no la hay. No hace
//      falta ningun guard en esta ruta.
//   2. Datos en el servidor: `loader` llama a getTareas(), una server function
//      que consulta Supabase y llega al HTML ya renderizado, sin parpadeo.
//   3. Contrato HTTP intacto: src/routes/api/tareas.ts sirve el mismo
//      /api/tareas de siempre, asi que OSTareas.tsx (el war room interactivo)
//      se monta SIN un solo cambio.
//   4. Shell real: OSLayout.tsx, el nav/header del OS portado desde
//      OSLayout.astro.
//
// El loader y OSTareas consultan la misma tabla, si: el loader da el resumen
// que se pinta en el servidor y OSTareas mantiene su propio ciclo de
// fetch/refresh tras cada alta o edicion. Se resuelve pasandole las tareas
// iniciales por prop cuando toque tocar el componente, que en este paso esta
// deliberadamente congelado.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSTareas from '../os/components/OSTareas.tsx';
import PageHeader from '../os/components/ui/PageHeader.tsx';
import { getTareas } from '../utils/tareas.functions.ts';

export const Route = createFileRoute('/tareas')({
  head: () => ({ meta: [{ title: tituloOs('Tareas') }] }),
  loader: () => getTareas(),
  component: TareasPage,
});

function TareasPage() {
  const { tareas, serverMs } = Route.useLoaderData();
  const abiertas = tareas.filter((t) => t.estado !== 'hecho').length;

  return (
    <OSLayout title="Tareas">
      <div className="os-fade-up">
        <PageHeader
          eyebrow="Growth OS"
          title="Tareas"
          subtitle="War room: agrupadas por urgencia, con subtareas y prioridad visual."
          actions={
            // Renderizado en el servidor con datos reales: si estos numeros
            // aparecen en el HTML inicial, el loader hizo su trabajo.
            <span className="os-mono" style={{ fontSize: 'var(--os-text-xs)', color: 'var(--os-muted)' }}>
              {abiertas} abiertas de {tareas.length} · {serverMs} ms en el servidor
            </span>
          }
        />

        <OSTareas />
      </div>
    </OSLayout>
  );
}
