// Query generator: builds Spanish variations around a seed topic.

const MODIFIERS = [
  'que',
  'como',
  'por que',
  'cuando',
  'donde',
  'para',
  'en',
  'sin',
  'versus',
  'ejemplos',
  'herramientas',
  'errores',
  'precio',
  'empresa',
  'negocio',
] as const;

const COUNTRY_MODIFIERS = ['Ecuador'] as const;

export interface GeneratorOptions {
  seed: string;
  country?: string;
}

function capitalizeWords(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Generates local variations for a seed topic. */
export function generateLocalQueries({ seed, country }: GeneratorOptions): string[] {
  const base = seed.trim();
  if (!base) return [];

  const queries: string[] = [];
  for (const mod of MODIFIERS) {
    queries.push(`${mod} ${base}`);
  }
  for (const mod of COUNTRY_MODIFIERS) {
    queries.push(`${mod} ${base}`);
    queries.push(`${base} ${mod}`);
  }
  if (country && country !== 'Ecuador') {
    queries.push(`${country} ${base}`);
    queries.push(`${base} ${country}`);
  }
  // Direct seed as anchor query
  queries.push(base);
  return queries;
}

/** Suggests formats by intent. */
export function suggestedFormatsForIntent(intent: string): string[] {
  switch (intent) {
    case 'aprender':
      return ['carrusel', 'guia'];
    case 'resolver':
      return ['tutorial', 'video'];
    case 'comparar':
      return ['post', 'opinion'];
    case 'comprar':
      return ['caso-estudio', 'landing'];
    case 'evaluar-riesgos':
      return ['newsletter', 'checklist'];
    case 'buscar-ejemplos':
      return ['video', 'carrusel'];
    case 'opinion-controversia':
      return ['ensayo', 'hilo', 'reel'];
    default:
      return ['post'];
  }
}

/** Suggests platforms by intent. */
export function suggestedPlatformsForIntent(intent: string): string[] {
  switch (intent) {
    case 'aprender':
      return ['LinkedIn', 'Instagram', 'Blog'];
    case 'resolver':
      return ['YouTube', 'Blog', 'TikTok'];
    case 'comparar':
      return ['LinkedIn', 'X', 'Blog'];
    case 'comprar':
      return ['LinkedIn', 'Landing'];
    case 'evaluar-riesgos':
      return ['Newsletter', 'LinkedIn'];
    case 'buscar-ejemplos':
      return ['Instagram', 'YouTube', 'TikTok'];
    case 'opinion-controversia':
      return ['X', 'LinkedIn', 'Instagram'];
    default:
      return ['LinkedIn'];
  }
}

export { MODIFIERS, COUNTRY_MODIFIERS, capitalizeWords };
