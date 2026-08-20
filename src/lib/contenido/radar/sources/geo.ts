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
