import { convertirAUsd, MONEDA_BASE, redondearCentavos } from './monedas.ts';

export type SeveridadFinanciera = 'alta' | 'media';
export interface PropuestaFinanciera {
  id: string;
  severidad: SeveridadFinanciera;
  titulo: string;
  contexto: string;
  recomendacion: string;
}

interface Cuenta { saldo?: number | null; moneda?: string | null; estado?: string | null }
interface Obligacion { id: string; monto?: number | null; moneda?: string | null; estado?: string | null; fecha_limite?: string | null; beneficiario?: string | null; acreedor?: string | null }
interface Cobro { id: string; monto?: number | null; moneda?: string | null; estado?: string | null; fecha_esperada?: string | null; cliente?: string | null }

export interface DiagnosticoFinanciero {
  disponible_usd: number;
  cobros_pendientes_usd: number;
  pagos_pendientes_usd: number;
  propuestas: PropuestaFinanciera[];
}

const usd = (monto: number | null | undefined, moneda: string | null | undefined) =>
  convertirAUsd(monto, moneda ?? MONEDA_BASE, null).monto_usd;

const venceEn = (fecha: string | null | undefined, hoy: string) => {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000);
};

/**
 * Detecta decisiones financieras, nunca las ejecuta. Cada propuesta debe pasar
 * por os_aprobaciones antes de que una persona o agente haga cualquier cambio.
 */
export function diagnosticarFinanzas(
  cuentas: Cuenta[], cobros: Cobro[], pagos: Obligacion[], deudas: Obligacion[], hoy: string,
): DiagnosticoFinanciero {
  const disponible = cuentas
    .filter((c) => c.estado !== 'bloqueada' && c.estado !== 'cerrada')
    .reduce((sum, c) => sum + usd(c.saldo, c.moneda), 0);
  const cobrosPendientes = cobros
    .filter((c) => c.estado !== 'cobrado')
    .reduce((sum, c) => sum + usd(c.monto, c.moneda), 0);
  const pagosPendientes = pagos
    .filter((p) => p.estado !== 'pagado')
    .reduce((sum, p) => sum + usd(p.monto, p.moneda), 0);
  const propuestas: PropuestaFinanciera[] = [];

  for (const cobro of cobros) {
    const dias = venceEn(cobro.fecha_esperada, hoy);
    if (cobro.estado !== 'cobrado' && dias !== null && dias < 0) {
      propuestas.push({
        id: `cobro:${cobro.id}`, severidad: 'alta', titulo: `Dar seguimiento a cobro vencido: ${cobro.cliente ?? 'cliente'}`,
        contexto: `Venció hace ${Math.abs(dias)} día(s).`,
        recomendacion: 'Preparar un seguimiento amable; no cambia el estado del cobro.',
      });
    }
  }
  for (const pago of [...pagos, ...deudas]) {
    const dias = venceEn(pago.fecha_limite, hoy);
    if (pago.estado !== 'pagado' && dias !== null && dias <= 3) {
      const quien = pago.beneficiario ?? pago.acreedor ?? 'obligación';
      propuestas.push({
        id: `pago:${pago.id}`, severidad: dias < 0 ? 'alta' : 'media', titulo: `Revisar pago próximo: ${quien}`,
        contexto: dias < 0 ? `Venció hace ${Math.abs(dias)} día(s).` : `Vence en ${dias} día(s).`,
        recomendacion: 'Confirmar saldo y fecha antes de pagar; esta propuesta no mueve dinero.',
      });
    }
  }
  if (pagosPendientes > disponible && pagosPendientes > 0) {
    propuestas.push({
      id: 'liquidez:pendiente', severidad: 'alta', titulo: 'Revisar cobertura de pagos pendientes',
      contexto: `Los pagos pendientes superan el disponible por ${redondearCentavos(pagosPendientes - disponible).toFixed(2)} USD.`,
      recomendacion: 'Priorizar vencimientos y confirmar cobros antes de comprometer nuevos gastos.',
    });
  }
  return {
    disponible_usd: redondearCentavos(disponible),
    cobros_pendientes_usd: redondearCentavos(cobrosPendientes),
    pagos_pendientes_usd: redondearCentavos(pagosPendientes),
    propuestas: propuestas.slice(0, 12),
  };
}
