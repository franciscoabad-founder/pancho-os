// Diversidad de areas via entropia de Shannon normalizada. 0 = toda la red
// del mismo dominio (peligroso: sin puentes hacia fuera). 1 = perfectamente
// repartida entre todas las areas presentes.

export interface PersonaArea {
  area: string;
}

export function entropiaAreas(personas: PersonaArea[]): number {
  if (personas.length === 0) return 0;

  const conteos = new Map<string, number>();
  for (const p of personas) {
    conteos.set(p.area, (conteos.get(p.area) ?? 0) + 1);
  }
  const areas = conteos.size;
  if (areas <= 1) return 0;

  const total = personas.length;
  let entropia = 0;
  for (const n of conteos.values()) {
    const p = n / total;
    entropia -= p * Math.log2(p);
  }
  const maxEntropia = Math.log2(areas);
  return maxEntropia === 0 ? 0 : entropia / maxEntropia;
}

/** Porcentaje por area, para pintar las barras de "diversidad por area". */
export function distribucionAreas(personas: PersonaArea[]): Array<{ area: string; pct: number }> {
  if (personas.length === 0) return [];
  const conteos = new Map<string, number>();
  for (const p of personas) conteos.set(p.area, (conteos.get(p.area) ?? 0) + 1);
  const total = personas.length;
  return Array.from(conteos.entries())
    .map(([area, n]) => ({ area, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}
