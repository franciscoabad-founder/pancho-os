import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { errMsgCrudo } from '../../../server/helpers.ts';
import { registrarIngresoDesdeLead } from '../../../server/crmFinanzas.handlers.ts';

export const Route = createFileRoute('/api/leads/ingreso')({ server: { handlers: {
  POST: async ({ request }) => {
    if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    try {
      const body = await request.json() as { lead_id?: string; fecha_esperada?: string };
      const resultado = await registrarIngresoDesdeLead(body.lead_id || '', body.fecha_esperada);
      return json(resultado, resultado.creado ? 201 : 200);
    } catch (e) {
      const message = errMsgCrudo(e);
      return json({ error: message }, message.includes('solo se puede') || message.includes('debe tener') || message.includes('requerido') ? 400 : 502);
    }
  },
} } });
