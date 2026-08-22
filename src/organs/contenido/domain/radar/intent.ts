// Intent classifier based on Spanish keyword patterns with weighted phrase matching.

import type { Intent } from './types.ts';

interface WeightedKeyword {
  phrase: string;
  weight: number;
}

const INTENT_KEYWORDS: Record<Intent, readonly WeightedKeyword[]> = {
  aprender: [
    { phrase: 'que es', weight: 2 },
    { phrase: 'que significa', weight: 2 },
    { phrase: 'como funciona', weight: 2 },
    { phrase: 'tutorial', weight: 1 },
    { phrase: 'guia', weight: 1 },
    { phrase: 'curso', weight: 1 },
    { phrase: 'aprender', weight: 1 },
    { phrase: 'explicacion', weight: 1 },
    { phrase: 'concepto', weight: 1 },
    { phrase: 'definicion', weight: 1 },
  ],
  resolver: [
    { phrase: 'como hacer', weight: 2 },
    { phrase: 'como solucionar', weight: 2 },
    { phrase: 'como arreglar', weight: 2 },
    { phrase: 'como evitar', weight: 2 },
    { phrase: 'problema', weight: 1 },
    { phrase: 'error', weight: 1 },
    { phrase: 'fallo', weight: 1 },
    { phrase: 'solucion', weight: 1 },
    { phrase: 'herramienta', weight: 1 },
    { phrase: 'paso a paso', weight: 1 },
  ],
  comparar: [
    { phrase: 'versus', weight: 2 },
    { phrase: 'vs', weight: 2 },
    { phrase: 'comparar', weight: 2 },
    { phrase: 'mejor', weight: 2 },
    { phrase: 'peor', weight: 2 },
    { phrase: 'diferencia', weight: 1 },
    { phrase: 'alternativa', weight: 1 },
    { phrase: 'opciones', weight: 1 },
    { phrase: 'review', weight: 1 },
    { phrase: 'comparativa', weight: 1 },
  ],
  comprar: [
    { phrase: 'precio', weight: 2 },
    { phrase: 'cuanto cuesta', weight: 2 },
    { phrase: 'comprar', weight: 1 },
    { phrase: 'contratar', weight: 2 },
    { phrase: 'proveedor', weight: 1 },
    { phrase: 'servicio', weight: 1 },
    { phrase: 'oferta', weight: 1 },
    { phrase: 'descuento', weight: 1 },
    { phrase: 'costo', weight: 1 },
    { phrase: 'presupuesto', weight: 1 },
  ],
  'evaluar-riesgos': [
    { phrase: 'riesgo', weight: 2 },
    { phrase: 'peligro', weight: 2 },
    { phrase: 'advertencia', weight: 2 },
    { phrase: 'estafa', weight: 2 },
    { phrase: 'fraude', weight: 2 },
    { phrase: 'consecuencia', weight: 1 },
    { phrase: 'seguridad', weight: 1 },
    { phrase: 'legal', weight: 1 },
    { phrase: 'multa', weight: 1 },
  ],
  'buscar-ejemplos': [
    { phrase: 'ejemplo', weight: 2 },
    { phrase: 'caso', weight: 1 },
    { phrase: 'muestra', weight: 1 },
    { phrase: 'plantilla', weight: 1 },
    { phrase: 'modelo', weight: 1 },
    { phrase: 'inspiracion', weight: 1 },
    { phrase: 'historia', weight: 1 },
    { phrase: 'exito', weight: 1 },
  ],
  'opinion-controversia': [
    { phrase: 'opinion', weight: 2 },
    { phrase: 'debate', weight: 2 },
    { phrase: 'controversia', weight: 2 },
    { phrase: 'critica', weight: 1 },
    { phrase: 'polemica', weight: 1 },
    { phrase: 'tendencia', weight: 1 },
    { phrase: 'moda', weight: 1 },
    { phrase: 'verdad', weight: 1 },
    { phrase: 'mentira', weight: 1 },
  ],
};

const INTENT_FALLBACK: Intent = 'aprender';

function scoreIntent(query: string, keywords: readonly WeightedKeyword[]): number {
  let score = 0;
  for (const kw of keywords) {
    if (query.includes(kw.phrase)) score += kw.weight;
  }
  return score;
}

/** Classifies a query into an intent bucket. */
export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  let best: Intent = INTENT_FALLBACK;
  let bestScore = 0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [Intent, readonly WeightedKeyword[]][]) {
    const score = scoreIntent(q, keywords);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

/** Human-readable explanation of the classification. */
export function explainIntent(query: string): string {
  const intent = classifyIntent(query);
  return `Clasificada como '${intent}' por palabras clave en la consulta.`;
}

export { INTENT_KEYWORDS, INTENT_FALLBACK };
