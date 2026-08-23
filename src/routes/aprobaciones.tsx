// Pagina /aprobaciones portada de src/pages/aprobaciones.astro a TanStack Start.
//
// No usa PageHeader a proposito: el .astro trae un header propio con una accion
// a la derecha (enlace a /sistema) y se copia tal cual para no cambiar el diseno
// en la migracion.
//
// OSAprobaciones habla con /api/aprobaciones (portada en
// src/routes/api/aprobaciones.ts), que es el mismo endpoint que consumen las
// tools MCP aprobaciones_listar y aprobaciones_solicitar.

import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSAprobaciones from '../os/components/OSAprobaciones.tsx';

export const Route = createFileRoute('/aprobaciones')({
  head: () => ({ meta: [{ title: tituloOs('Aprobaciones') }] }),
  component: AprobacionesPage,
});

function AprobacionesPage() {
  return (
    <OSLayout title="Aprobaciones">
      <div className="os-fade-up">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <p className="os-eyebrow" style={{ marginBottom: 6 }}>Gate</p>
            <h1 className="os-h1">Aprobaciones</h1>
          </div>
          <a className="os-btn os-btn-ghost" href="/sistema" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_tree</span>
            Mi Sistema
          </a>
        </div>

        <div className="os-card os-card-accent" style={{ marginBottom: '1rem' }}>
          <p className="os-section-title">Como opera</p>
          <p style={{ fontSize: 13, color: 'var(--os-text-2)', lineHeight: 1.6, margin: 0 }}>
            Las decisiones sensibles pasan por este gate. Si `APPROVAL_WEBHOOK_URL` esta configurado, cada aprobacion se envia a n8n para que Hermes ejecute el siguiente paso.
          </p>
        </div>

        <OSAprobaciones />
      </div>
    </OSLayout>
  );
}
