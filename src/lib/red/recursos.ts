// Balance de tipos de lazo (Ibarra & Hunter): operacional, personal,
// estrategico. El sesgo mas comun de quien opera mucho es tener casi todo
// operacional y casi nada estrategico -- red que ejecuta pero no abre
// puertas nuevas.

export type TipoLazo = 'operacional' | 'personal' | 'estrategico';

export interface PersonaLazo {
  tipo_lazo: TipoLazo;
}

export interface Balance {
  operacional: number;
  personal: number;
  estrategico: number;
  alerta: string | null;
}

const UMBRAL_ESTRATEGICO_BAJO = 0.2; // 20%, mismo umbral que el prototipo de Stitch usó de forma acertada

export function balanceLazos(personas: PersonaLazo[]): Balance {
  const total = personas.length;
  if (total === 0) {
    return { operacional: 0, personal: 0, estrategico: 0, alerta: null };
  }
  const contar = (t: TipoLazo) => personas.filter((p) => p.tipo_lazo === t).length / total;
  const operacional = contar('operacional');
  const personal = contar('personal');
  const estrategico = contar('estrategico');

  const alerta =
    estrategico < UMBRAL_ESTRATEGICO_BAJO
      ? `Los vinculos estrategicos son ${Math.round(estrategico * 100)}% de tu red, por debajo del ${Math.round(UMBRAL_ESTRATEGICO_BAJO * 100)}% recomendado.`
      : null;

  return { operacional, personal, estrategico, alerta };
}
