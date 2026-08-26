import { getSupabaseServer } from './supabase.ts';
import { crearAprobacion } from './aprobaciones.handlers.ts';
import { diagnosticarFinanzas, type DiagnosticoFinanciero, type PropuestaFinanciera } from '../lib/finanzas/asesor.ts';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });

export async function obtenerDiagnosticoFinanciero(): Promise<DiagnosticoFinanciero> {
  const sb = getSupabaseServer();
  const [cuentas, cobros, pagos, deudas] = await Promise.all([
    sb.from('cuentas').select('saldo, moneda, estado'),
    sb.from('por_cobrar').select('id, monto, moneda, estado, fecha_esperada, cliente'),
    sb.from('por_pagar').select('id, monto, moneda, estado, fecha_limite, beneficiario'),
    sb.from('deudas').select('id, monto, moneda, estado, fecha_limite, acreedor'),
  ]);
  for (const r of [cuentas, cobros, pagos, deudas]) if (r.error) throw r.error;
  return diagnosticarFinanzas(cuentas.data ?? [], cobros.data ?? [], pagos.data ?? [], deudas.data ?? [], hoy());
}

export async function proponerParaAprobacion(id: unknown): Promise<unknown> {
  const propuestaId = typeof id === 'string' ? id : '';
  const diagnostico = await obtenerDiagnosticoFinanciero();
  const propuesta = diagnostico.propuestas.find((p) => p.id === propuestaId);
  if (!propuesta) throw new Error('propuesta no disponible');
  return crearAprobacion({
    titulo: propuesta.titulo,
    contexto: propuesta.contexto,
    opciones: ['Revisar ahora', 'Posponer'],
    recomendacion: propuesta.recomendacion,
  });
}

export type { PropuestaFinanciera };
