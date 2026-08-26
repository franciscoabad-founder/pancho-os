import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { getSupabaseServer } from '../../../server/supabase.ts';
import { addDays, mondayOf, sugerirTimeblocks } from '../../../server/timeblocking.handlers.ts';
import { hoyGuayaquil } from '../../../lib/salud/apiHelpers.ts';

export const Route = createFileRoute('/api/semana/timeblocks')({ server: { handlers: {
  GET: async ({ request }) => {
    if (!(await isOsAuthorized(request))) return json({ error: 'Unauthorized' }, 401);
    try {
      const url = new URL(request.url);
      const semanaParam = url.searchParams.get('semana') || hoyGuayaquil();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaParam) || Number.isNaN(Date.parse(`${semanaParam}T00:00:00Z`))) return json({ error: 'semana debe ser YYYY-MM-DD' }, 400);
      const minutosParam = url.searchParams.get('minutos');
      if (minutosParam !== null && (!/^\d+$/.test(minutosParam) || Number(minutosParam) < 15)) return json({ error: 'minutos debe ser un entero >= 15' }, 400);
      const semana = mondayOf(semanaParam); const fin = addDays(semana, 6);
      const sb = getSupabaseServer();
      const [dias, eventos, presupuesto] = await Promise.all([
        sb.from('os_semana').select('dia,modo').order('dia'),
        sb.from('reuniones').select('fecha,fin,titulo').gte('fecha', `${semana}T00:00:00`).lte('fecha', `${fin}T23:59:59`),
        sb.from('os_funcion_presupuesto').select('funcion,horas_semana_objetivo'),
      ]);
      for (const result of [dias, eventos, presupuesto]) if (result.error) throw result.error;
      const slots = sugerirTimeblocks({ semana, dias: dias.data ?? [], eventos: eventos.data ?? [], presupuesto: presupuesto.data ?? [], horaInicio: url.searchParams.get('hora_inicio') || undefined, horaFin: url.searchParams.get('hora_fin') || undefined, minimoMinutos: minutosParam === null ? 60 : Number(minutosParam) });
      return json({ semana_inicio: semana, semana_fin: fin, slots, solo_sugerencias: true });
    } catch (err) { return json({ error: err instanceof Error ? err.message : String(err) }, 502); }
  },
} } });
