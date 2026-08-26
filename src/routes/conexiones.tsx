import { createFileRoute } from '@tanstack/react-router';
import OSLayout, { tituloOs } from '../os/components/OSLayout.tsx';
import OSConexiones from '../os/components/OSConexiones.tsx';

export const Route = createFileRoute('/conexiones')({ head: () => ({ meta: [{ title: tituloOs('Conexiones') }] }), component: ConexionesPage });
function ConexionesPage() { return <OSLayout title="Conexiones"><div className="os-fade-up"><OSConexiones /></div></OSLayout>; }
