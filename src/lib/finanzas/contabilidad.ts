// Contabilidad simple del mes, en USD.
//
// A proposito NO es partida doble: no hay asientos, ni debe/haber, ni cuadre.
// Es la vista que Pancho necesita para abrir el mes y saber tres cosas:
// cuanto entro, cuanto salio y en que, y cuanto hay repartido en sus cuentas.
//
// Reglas:
// - Ingresos = por_cobrar en estado `cobrado` con fecha_esperada dentro del mes.
//   Es la unica senal de dinero que efectivamente entro que hoy tiene el OS.
// - Gastos = gastos del mes, sumados por `monto_usd` (nunca por `monto`, que
//   esta en la moneda en la que se pago).
// - Saldos = suma de cuentas por moneda. Las cuentas `bloqueada` y `cerrada`
//   se totalizan aparte porque su saldo no es dinero disponible (el banco de
//   Ecuador congelado por coactiva es justo ese caso).
//
// Modulo puro: recibe los arreglos ya cargados y no toca red ni base.

import { MONEDA_BASE, convertirAUsd, redondearCentavos } from './monedas.ts';

export interface GastoContable {
  fecha?: string | null;
  categoria?: string | null;
  monto?: number | null;
  moneda?: string | null;
  monto_usd?: number | null;
}

export interface PorCobrarContable {
  monto?: number | null;
  moneda?: string | null;
  estado?: string | null;
  fecha_esperada?: string | null;
}

export interface CuentaContable {
  nombre?: string;
  moneda?: string | null;
  saldo?: number | null;
  estado?: string | null;
}

export interface ResumenMes {
  mes: string;
  ingresos_usd: number;
  gastos_usd: number;
  neto_usd: number;
  /** Gasto del mes por categoria, en USD, de mayor a menor. */
  por_categoria: Array<{ categoria: string; total_usd: number; pct: number }>;
  /** Saldo disponible sumado de las cuentas activas, en USD. */
  saldo_cuentas_usd: number;
  /** Saldo retenido en cuentas bloqueadas o cerradas, en USD. */
  saldo_no_disponible_usd: number;
  /** Cuantos gastos del mes usaron una tasa aproximada. */
  gastos_aproximados: number;
}

const mesDe = (fecha?: string | null): string => (fecha || '').slice(0, 7);

/**
 * Monto en USD de un gasto. Prefiere `monto_usd` (calculado al guardar con la
 * tasa del dia). Solo si falta, por filas viejas anteriores a la migracion,
 * convierte al vuelo con el respaldo estatico.
 */
export function gastoEnUsd(g: GastoContable): number {
  if (typeof g.monto_usd === 'number' && Number.isFinite(g.monto_usd)) return g.monto_usd;
  return convertirAUsd(g.monto, g.moneda ?? MONEDA_BASE, null).monto_usd;
}

export function resumenMensual(
  mes: string,
  gastos: GastoContable[],
  porCobrar: PorCobrarContable[],
  cuentas: CuentaContable[],
): ResumenMes {
  const gastosMes = gastos.filter((g) => mesDe(g.fecha) === mes);

  let gastosUsd = 0;
  const porCategoria = new Map<string, number>();
  for (const g of gastosMes) {
    const usd = gastoEnUsd(g);
    gastosUsd += usd;
    const cat = g.categoria?.trim() || 'Sin categoria';
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + usd);
  }
  gastosUsd = redondearCentavos(gastosUsd);

  const ingresosUsd = redondearCentavos(
    porCobrar
      .filter((p) => p.estado === 'cobrado' && mesDe(p.fecha_esperada) === mes)
      .reduce((s, p) => s + convertirAUsd(p.monto, p.moneda ?? MONEDA_BASE, null).monto_usd, 0),
  );

  let disponible = 0;
  let noDisponible = 0;
  for (const c of cuentas) {
    const usd = convertirAUsd(c.saldo, c.moneda ?? MONEDA_BASE, null).monto_usd;
    if (c.estado === 'bloqueada' || c.estado === 'cerrada') noDisponible += usd;
    else disponible += usd;
  }

  const categorias = Array.from(porCategoria.entries())
    .map(([categoria, total]) => ({
      categoria,
      total_usd: redondearCentavos(total),
      pct: gastosUsd > 0 ? Math.round((total / gastosUsd) * 100) : 0,
    }))
    .sort((a, b) => b.total_usd - a.total_usd);

  return {
    mes,
    ingresos_usd: ingresosUsd,
    gastos_usd: gastosUsd,
    neto_usd: redondearCentavos(ingresosUsd - gastosUsd),
    por_categoria: categorias,
    saldo_cuentas_usd: redondearCentavos(disponible),
    saldo_no_disponible_usd: redondearCentavos(noDisponible),
    gastos_aproximados: gastosMes.filter((g) => (g as { conversion_aproximada?: boolean }).conversion_aproximada).length,
  };
}
