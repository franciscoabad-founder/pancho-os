// Maps human country names (as used in the UI) to ISO 3166-1 alpha-2 codes
// used by external providers (gl / cc / regionCode params).

const COUNTRY_TO_ISO: Record<string, string> = {
  ecuador: 'ec',
  mexico: 'mx',
  colombia: 'co',
  argentina: 'ar',
  peru: 'pe',
  chile: 'cl',
  espana: 'es',
  'estados unidos': 'us',
  uruguay: 'uy',
  'costa rica': 'cr',
  panama: 'pa',
  guatemala: 'gt',
  'republica dominicana': 'do',
  venezuela: 've',
  bolivia: 'bo',
  paraguay: 'py',
  'el salvador': 'sv',
  honduras: 'hn',
  nicaragua: 'ni',
};

/** Returns lowercase ISO code ('ec') or undefined when the country is unknown. */
export function countryToIso(country: string): string | undefined {
  const key = country
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/^[a-z]{2}$/.test(key)) return key;
  return COUNTRY_TO_ISO[key];
}

// Mercados que Bing (via SerpAPI) soporta en el parametro cc. Paises fuera de
// esta lista (Ecuador, Peru, Bolivia...) provocan HTTP 400 "Unsupported
// country": para ellos se omite cc y Bing responde con su mercado por defecto.
const BING_SUPPORTED_CC = new Set([
  'ar', 'au', 'at', 'be', 'br', 'ca', 'cl', 'cn', 'co', 'dk', 'fi', 'fr', 'de',
  'hk', 'in', 'id', 'ie', 'it', 'jp', 'kr', 'my', 'mx', 'nl', 'nz', 'no', 'ph',
  'pl', 'pt', 'ru', 'sa', 'za', 'es', 'se', 'ch', 'tw', 'tr', 'gb', 'us',
]);

/** ISO code solo si Bing lo soporta como mercado; undefined si no. */
export function countryToBingCc(country: string): string | undefined {
  const iso = countryToIso(country);
  return iso && BING_SUPPORTED_CC.has(iso) ? iso : undefined;
}
