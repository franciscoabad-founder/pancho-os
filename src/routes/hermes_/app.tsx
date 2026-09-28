// Pagina /hermes/app: Hermes completo (la app oficial de Hermes Desktop
// compilada como web por hermes-ui/, con Capabilities, pantalla del bot,
// tareas programadas y sesiones de todos los canales).
//
// Decision 1b = A (28-sep-2026): el servicio hermes-ui vive en el VPS y solo
// escucha en Tailscale, porque da acceso a claves y a la terminal del VPS. Por
// eso esta pagina no hace proxy: enlaza (o incrusta, si la URL es https) el
// servicio, que solo abre desde un equipo conectado a Tailscale.
// Carpeta `hermes_`: desanida la ruta de /hermes sin cambiar la URL (ver habitos_).

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../../os/components/OSLayout.tsx';
import PageHeader from '../../os/components/ui/PageHeader.tsx';

const HERMES_UI_URL: string = import.meta.env.VITE_HERMES_UI_URL ?? 'http://100.127.42.51:9120';

export const Route = createFileRoute('/hermes_/app')({
  head: () => ({ meta: [{ title: tituloOs('Hermes completo') }] }),
  component: HermesAppPage,
});

function HermesAppPage() {
  // Una pagina https no puede incrustar un http (contenido mixto): el iframe
  // solo aparece cuando hermes-ui se sirve por https (tailscale serve).
  const incrustable = HERMES_UI_URL.startsWith('https://');

  return (
    <OSLayout title="Hermes completo">
      <div className="os-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PageHeader
          eyebrow="Operacion Agente"
          title="Hermes completo"
          subtitle="Chat, sesiones de todos los canales, Capabilities (skills, plugins y MCP), tareas programadas y la pantalla del bot. Solo abre con Tailscale encendido."
          actions={
            <a className="os-btn" href={HERMES_UI_URL} rel="noreferrer" target="_blank">
              Abrir Hermes completo
            </a>
          }
        />
        {incrustable ? (
          <iframe
            allow="clipboard-read; clipboard-write; microphone"
            src={HERMES_UI_URL}
            style={{ width: '100%', height: 'calc(100vh - 220px)', minHeight: 520, border: '1px solid var(--os-border)', borderRadius: 12 }}
            title="Hermes completo"
          />
        ) : (
          <div className="os-card" style={{ padding: 16, lineHeight: 1.6, fontSize: 'var(--os-text-sm)' }}>
            <p style={{ margin: 0 }}>Se abre en una pestaña nueva, en <code>{HERMES_UI_URL}</code>.</p>
            <p style={{ margin: '6px 0 0', color: 'var(--os-muted)' }}>
              Si no carga: enciende Tailscale en este equipo. El botón Update está desactivado; el VPS se actualiza por SSH.
            </p>
          </div>
        )}
      </div>
    </OSLayout>
  );
}
