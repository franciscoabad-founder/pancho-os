// Conversion de monedas para el modulo Finanzas.
//
// La moneda base de Pancho OS es USD (Pancho es ecuatoriano y Ecuador esta
// dolarizado). Todo gasto se guarda con su monto original en la moneda en la
// que se pago y ademas con `monto_usd`, que es el numero con el que se hace
// cualquier suma, resumen o contabilidad.
//
// Este modulo es puro: no toca red ni base de datos. Recibe una tabla de tasas
// (la que trae src/server/fxRates.ts desde open.er-api.com, cacheada a diario)
// y, si no hay tabla o le falta la moneda, cae a TASAS_ESTATICAS y marca la
// conversion como `aproximada` para que el UI pueda avisarlo.

export const MONEDA_BASE = 'USD';

/**
 * Unidades de cada moneda por 1 USD. Respaldo estatico: se usa cuando la API
 * de tasas falla o no cubre la moneda. Valores de referencia de agosto 2026,
 * suficientes para un gasto de viaje pero no para contabilidad exacta: por eso
 * toda conversion que salga de aqui viaja marcada como aproximada.
 */
export const TASAS_ESTATICAS: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  MXN: 18.5,
  COP: 4100,
  ARS: 1050,
  BRL: 5.4,
  PEN: 3.75,
  CLP: 950,
  GBP: 0.79,
  CAD: 1.36,
  GTQ: 7.8,
  CRC: 520,
  DOP: 60,
  UYU: 40,
  BOB: 6.9,
  PYG: 7500,
  CHF: 0.88,
});

/** Catalogo que pinta el selector de moneda del formulario de gastos. */
export const MONEDAS_COMUNES: ReadonlyArray<{ codigo: string; nombre: string }> = Object.freeze([
  { codigo: 'USD', nombre: 'Dolar estadounidense' },
  { codigo: 'EUR', nombre: 'Euro' },
  { codigo: 'MXN', nombre: 'Peso mexicano' },
  { codigo: 'COP', nombre: 'Peso colombiano' },
  { codigo: 'ARS', nombre: 'Peso argentino' },
  { codigo: 'BRL', nombre: 'Real brasileno' },
  { codigo: 'PEN', nombre: 'Sol peruano' },
  { codigo: 'CLP', nombre: 'Peso chileno' },
  { codigo: 'GBP', nombre: 'Libra esterlina' },
  { codigo: 'CAD', nombre: 'Dolar canadiense' },
  { codigo: 'GTQ', nombre: 'Quetzal' },
  { codigo: 'CRC', nombre: 'Colon costarricense' },
  { codigo: 'DOP', nombre: 'Peso dominicano' },
  { codigo: 'UYU', nombre: 'Peso uruguayo' },
  { codigo: 'BOB', nombre: 'Boliviano' },
  { codigo: 'PYG', nombre: 'Guarani' },
  { codigo: 'CHF', nombre: 'Franco suizo' },
]);

export interface Conversion {
  /** Monto expresado en USD, redondeado a centavos. */
  monto_usd: number;
  /** Unidades de la moneda original por 1 USD que se usaron. */
  tasa: number;
  /** true cuando la tasa salio de TASAS_ESTATICAS y no de la API del dia. */
  aproximada: boolean;
  /** Codigo ISO normalizado que se termino usando. */
  moneda: string;
}

/**
 * Lleva cualquier entrada a un codigo ISO de 3 letras en mayusculas.
 * Vacio, basura o no-string caen a USD: preferimos asumir la moneda base antes
 * que guardar un gasto con moneda invalida que despues no se pueda sumar.
 */
export function normalizarMoneda(valor: unknown): string {
  if (typeof valor !== 'string') return MONEDA_BASE;
  const limpio = valor.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(limpio) ? limpio : MONEDA_BASE;
}

/** Redondeo a centavos sin arrastrar el error binario de toFixed encadenado. */
export function redondearCentavos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Convierte `monto` desde `moneda` hacia USD.
 *
 * @param tasas tabla del dia (unidades por USD). Si no viene, o no cubre la
 *   moneda, se usa TASAS_ESTATICAS y la conversion queda marcada aproximada.
 */
export function convertirAUsd(
  monto: unknown,
  moneda: unknown,
  tasas?: Record<string, number> | null,
): Conversion {
  const codigo = normalizarMoneda(moneda);
  const valor = Number(monto);
  const montoNum = Number.isFinite(valor) ? valor : 0;

  if (codigo === MONEDA_BASE) {
    return { monto_usd: redondearCentavos(montoNum), tasa: 1, aproximada: false, moneda: codigo };
  }

  const delDia = tasas?.[codigo];
  if (typeof delDia === 'number' && Number.isFinite(delDia) && delDia > 0) {
    return { monto_usd: redondearCentavos(montoNum / delDia), tasa: delDia, aproximada: false, moneda: codigo };
  }

  const estatica = TASAS_ESTATICAS[codigo];
  if (typeof estatica === 'number' && estatica > 0) {
    return { monto_usd: redondearCentavos(montoNum / estatica), tasa: estatica, aproximada: true, moneda: codigo };
  }

  // Moneda que no conocemos de ninguna forma: no inventamos un numero, se
  // guarda el monto tal cual y queda marcado aproximado para revisarlo a mano.
  return { monto_usd: redondearCentavos(montoNum), tasa: 1, aproximada: true, moneda: codigo };
}

/** Formato de display consistente en todo el modulo. Base USD por defecto. */
export function formatearMonto(monto: unknown, moneda: string = MONEDA_BASE): string {
  const v = Number(monto) || 0;
  return `${v.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${moneda}`;
}
