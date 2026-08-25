// Scorecard completo en una sola llamada: junta apertura + diversidad +
// balance. Es lo que consume la pantalla de Scorecard.

import { densidad, banda, distanciaAlIdeal, type Banda } from './apertura.ts';
import { entropiaAreas, distribucionAreas } from './diversidad.ts';
import { balanceLazos, type Balance, type TipoLazo } from './recursos.ts';

export interface PersonaDiagnostico {
  area: string;
  tipo_lazo: TipoLazo;
}

export interface Diagnostico {
  apertura: { densidad: number; banda: Banda; distanciaAlIdeal: number };
  diversidad: { entropia: number; porArea: Array<{ area: string; pct: number }> };
  balance: Balance;
}

export function resumen(personas: PersonaDiagnostico[], nConexiones: number): Diagnostico {
  const d = densidad(personas.length, nConexiones);
  return {
    apertura: { densidad: d, banda: banda(d), distanciaAlIdeal: distanciaAlIdeal(d) },
    diversidad: { entropia: entropiaAreas(personas), porArea: distribucionAreas(personas) },
    balance: balanceLazos(personas),
  };
}
