import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { addDays, mondayOf, sugerirTimeblocks } from '../../../server/timeblocking.handlers.ts';
import { hoyGuayaquil } from '../../../lib/salud/apiHelpers.ts';

export const Route = createFileRoute('/api/semana/timeblocks')({ server: { handlers: {
  GET: async ({ request }) => {
    if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    try {
      const url = new URL(request.url); const semana = mondayOf(url.searchParams.get('semana') || hoyGuayaquil()); const fin = addDays(semana, 6);
      const sb = getSupabaseServer();
      const [dias, eventos, presupuesto] = await Promise.all([
        sb.from('os_semana').select('dia,modo').order('dia'),
        sb.from('reuniones').select('fecha,fin,titulo').gte('fecha', `${semana}T00:00:00`).lte('fecha', `${fin}T23:59:59`),
        sb.from('os_funcion_presupuesto').select('funcion,horas_semana_objetivo'),
      ]);
      for (const result of [dias, eventos, presupuesto]) if (result.error) throw result.error;
      const slots = sugerirTimeblocks({ semana, dias: dias.data ?? [], eventos: eventos.data ?? [], presupuesto: presupuesto.data ?? [], horaInicio: url.searchParams.get('hora_inicio') || undefined, horaFin: url.searchParams.get('hora_fin') || undefined, minimoMinutos: Number(url.searchParams.get('minutos') || 60) });
      return json({ semana_inicio: semana, semana_fin: fin, slots, solo_sugerencias: true });
    } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  },
} } });
