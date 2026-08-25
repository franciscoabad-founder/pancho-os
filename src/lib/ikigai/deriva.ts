// Comparar dos versiones del mapa (mapa anterior vs mapa actual) para ver
// que cambio. El "que agregaste, que quitaste, que se mantiene" es lo que
// hace que rehacer el diagnostico se sienta vivo en vez de un formulario que
// se llena una vez.

export interface ItemComparable {
  id: string;
  texto: string;
  cuadrante: string;
}

export interface Deriva {
  agregados: ItemComparable[];
  quitados: ItemComparable[];
  estables: ItemComparable[];
}

// La igualdad es por texto normalizado + cuadrante, no por id: un item
// "nuevo" en la version siguiente que dice lo mismo que uno viejo es el
// MISMO pensamiento, no una novedad. Comparar por id siempre marcaria todo
// como agregado/quitado porque cada version tiene sus propias filas.
function clave(item: ItemComparable): string {
  return `${item.cuadrante}::${item.texto.trim().toLocaleLowerCase('es-EC')}`;
}

export function comparar(anterior: ItemComparable[], actual: ItemComparable[]): Deriva {
  const clavesAnterior = new Map(anterior.map((i) => [clave(i), i]));
  const clavesActual = new Map(actual.map((i) => [clave(i), i]));

  const agregados = actual.filter((i) => !clavesAnterior.has(clave(i)));
  const quitados = anterior.filter((i) => !clavesActual.has(clave(i)));
  const estables = actual.filter((i) => clavesAnterior.has(clave(i)));

  return { agregados, quitados, estables };
}
