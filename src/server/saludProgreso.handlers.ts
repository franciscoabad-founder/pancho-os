// Logica de /api/salud/progreso, portada de src/pages/api/salud/progreso.ts.
//
// Devuelve los datos crudos para analytics de progreso. La logica (progressIndex,
// sugerenciaOverload, e1RM, promedio movil) vive en src/lib/salud/progresion.ts y la
// consumen la UI de progreso y el modo sesion activa (una sola fuente de verdad testeada).

import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from '../lib/salud/apiHelpers.ts';

interface SetRow {
  ejercicio_id: string; ejercicio_nombre: string; grupo: string | null;
  patron: string | null; reps: number | null; peso_kg: number | null;
  tipo_set: string; fecha: string;
}

export async function leerProgreso(diasParam: number) {
  const sb = getSupabaseServer();
  const dias = diasParam || 120;
  // Ventana anclada a la fecha local de Guayaquil (las columnas `fecha` son locales UTC-5).
  // Se ancla a mediodía para que restar días completos no cruce el borde de zona horaria.
  const anchor = new Date(hoyGuayaquil() + 'T12:00:00');
  anchor.setDate(anchor.getDate() - dias);
  const desde = anchor.toLocaleDateString('en-CA');

  // Sets con datos de ejercicio y fecha de sesión.
  const { data: sesiones, error } = await sb
    .from('sesiones')
    .select('id, fecha, sets_log(reps, peso_kg, tipo_set, ejercicio_id, ejercicio:ejercicios(nombre, patron, grupo_muscular_primario))')
    .gte('fecha', desde)
    .order('fecha', { ascending: true });
  if (error) throw error;

  const sets: SetRow[] = [];
  for (const s of sesiones ?? []) {
    for (const sl of (s as any).sets_log ?? []) {
      sets.push({
        ejercicio_id: sl.ejercicio_id,
        ejercicio_nombre: sl.ejercicio?.nombre ?? 'Ejercicio',
        grupo: sl.ejercicio?.grupo_muscular_primario ?? null,
        patron: sl.ejercicio?.patron ?? null,
        reps: sl.reps, peso_kg: sl.peso_kg, tipo_set: sl.tipo_set,
        fecha: (s as any).fecha,
      });
    }
  }

  // Serie de peso corporal (para promedio móvil de 7 días en el cliente).
  // OJO: lee SOLO cuerpo_log, asi que los dias en que el peso llego por
  // Google Health (biometricas_dia.peso_kg) quedan como hueco en el grafico.
  // Cambiar esto por serieDePeso() de src/lib/salud/peso.ts (que cruza las dos
  // tablas con la regla "cuerpo_log manda, biometricas_dia rellena") es un
  // cambio de comportamiento, no de migracion: el port a TanStack Start se hizo
  // a contrato congelado y esa mejora va en su propio commit, con la
  // verificacion contra OSSaludProgreso que amerita.
  const { data: cuerpo, error: errCuerpo } = await sb
    .from('cuerpo_log')
    .select('fecha, peso_kg, sueno_horas')
    .gte('fecha', desde)
    .order('fecha', { ascending: true });
  if (errCuerpo) throw errCuerpo;

  return { sets, cuerpo: cuerpo ?? [] };
}
