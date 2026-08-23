// Generador de QR minimo, sin dependencias.
//
// Por que a mano: el repo no tiene ninguna libreria de QR instalada (se
// verifico en node_modules antes de escribir esto) y lo que hay que codificar
// es corto y conocido: la URL de emparejamiento de un dispositivo. Traer una
// dependencia nueva con su arbol para eso no se justifica.
//
// Alcance DELIBERADAMENTE recortado, y esa es la razon de que el archivo entre
// en una pantalla:
//   - Versiones 1 a 5 (21x21 a 37x37), SOLO en las combinaciones que usan UN
//     unico bloque de correccion de errores. Eso evita el intercalado de
//     bloques, que es la parte fea del estandar. Ver CONFIGS.
//   - Modo numerico (para los 6 digitos del codigo) y modo byte (para la URL).
//   - Sin bloque de informacion de version: aparece recien en la version 7.
//   - Un unico patron de alineacion, que es lo que llevan las versiones 2 a 6.
//
// Techo real: 106 bytes en 5-L. Si algun dia hay que meter mas que eso, ahi si
// corresponde instalar una libreria en vez de estirar este archivo: el paso
// siguiente es el intercalado multi bloque y las versiones 7+ con su BCH de
// version, y eso ya es el encoder completo.
//
// Referencia del algoritmo: ISO/IEC 18004. Los vectores de prueba de
// src/lib/qr.test.ts son el ejemplo canonico "01234567" en 1-M.

// --- configuraciones soportadas ---------------------------------------------
//
// datos + ecc = codewords totales de la version. Solo entran combinaciones de
// UN bloque: en cuanto una version/nivel se parte en dos bloques (4-M, 6-L y
// de ahi para arriba) hace falta intercalar, y este archivo no lo hace.
export interface ConfigQr {
  version: number;
  nivel: 'L' | 'M';
  /** Codewords de datos del unico bloque. */
  datos: number;
  /** Codewords de correccion de errores del unico bloque. */
  ecc: number;
}

const CONFIGS: readonly ConfigQr[] = [
  { version: 1, nivel: 'M', datos: 16, ecc: 10 },
  { version: 2, nivel: 'M', datos: 28, ecc: 16 },
  { version: 3, nivel: 'M', datos: 44, ecc: 26 },
  { version: 4, nivel: 'L', datos: 80, ecc: 20 },
  { version: 5, nivel: 'L', datos: 108, ecc: 26 },
];

/** La configuracion historica de este modulo: 1-M, la del codigo de 6 digitos. */
export const CONFIG_NUMERICA: ConfigQr = CONFIGS[0];

export const QR_VERSION = CONFIG_NUMERICA.version;
export const QR_SIZE = 21;
/** Capacidad en digitos de un 1-M en modo numerico. */
export const QR_MAX_DIGITOS = 34;
/** Capacidad en bytes de la configuracion mas grande soportada (5-L). */
export const QR_MAX_BYTES = CONFIGS[CONFIGS.length - 1].datos - 2;

/** Lado en modulos de una version, sin zona tranquila. */
export function tamanoQr(version: number): number {
  return 17 + 4 * version;
}

// Cabecera del modo byte: 4 bits de indicador + 8 bits de contador en las
// versiones 1 a 9. Son 12 bits, o sea que se pierden 1.5 bytes de capacidad y
// el medio byte suelto no alcanza para un caracter mas.
function capacidadBytes(config: ConfigQr): number {
  return config.datos - 2;
}

// --- GF(256) -----------------------------------------------------------------
// Campo de Galois con polinomio primitivo 0x11D, el que usa QR.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Polinomio generador de grado n, coeficientes de mayor a menor grado. */
function polinomioGenerador(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const siguiente = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      siguiente[j] ^= g[j];
      siguiente[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = siguiente;
  }
  return g;
}

/** Resto de la division polinomica: los codewords de correccion de errores. */
export function codewordsEcc(datos: number[], cantidad: number): number[] {
  const g = polinomioGenerador(cantidad);
  const resto = datos.concat(new Array<number>(cantidad).fill(0));
  for (let i = 0; i < datos.length; i++) {
    const coef = resto[i];
    if (coef === 0) continue;
    for (let j = 0; j < g.length; j++) resto[i + j] ^= mul(g[j], coef);
  }
  return resto.slice(datos.length);
}

// --- Codificacion de los datos ----------------------------------------------

class Bits {
  readonly valores: number[] = [];

  push(valor: number, cantidad: number): void {
    for (let i = cantidad - 1; i >= 0; i--) this.valores.push((valor >> i) & 1);
  }
}

/** Bits -> codewords de datos completos: terminador, relleno de byte y padding. */
function empaquetar(bits: Bits, config: ConfigQr): number[] {
  const capacidad = config.datos * 8;
  if (bits.valores.length > capacidad) {
    throw new Error('qr: los datos no entran en la configuracion elegida');
  }
  // Terminador: hasta 4 ceros, menos si no entran.
  bits.push(0, Math.min(4, capacidad - bits.valores.length));
  // Relleno hasta cerrar el byte.
  while (bits.valores.length % 8 !== 0) bits.valores.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.valores.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits.valores[i + j];
    codewords.push(byte);
  }
  // Bytes de relleno alternados que manda el estandar.
  const RELLENO = [0xec, 0x11];
  while (codewords.length < config.datos) codewords.push(RELLENO[codewords.length % 2]);

  return codewords;
}

/**
 * Digitos -> codewords de datos de un 1-M (16 bytes, ya con terminador y
 * relleno). Se exporta para poder verificarlo contra el vector canonico en los
 * tests.
 */
export function codewordsDatosNumericos(digitos: string): number[] {
  if (!/^[0-9]+$/.test(digitos)) throw new Error('qr: solo se admiten digitos');
  if (digitos.length > QR_MAX_DIGITOS) throw new Error(`qr: maximo ${QR_MAX_DIGITOS} digitos`);

  const bits = new Bits();
  bits.push(0b0001, 4); // indicador de modo numerico
  bits.push(digitos.length, 10); // contador de caracteres, 10 bits en version 1-9

  for (let i = 0; i < digitos.length; i += 3) {
    const grupo = digitos.slice(i, i + 3);
    // 3 digitos -> 10 bits, 2 -> 7 bits, 1 -> 4 bits.
    bits.push(Number(grupo), grupo.length === 3 ? 10 : grupo.length === 2 ? 7 : 4);
  }

  return empaquetar(bits, CONFIG_NUMERICA);
}

const codificador = new TextEncoder();

/**
 * Texto -> codewords de datos en modo byte (ISO-8859-1 segun el estandar, pero
 * en la practica todo escaner moderno lee UTF-8 y es lo que emitimos; la URL de
 * pairing es ASCII pura de todos modos).
 */
export function codewordsDatosBytes(texto: string, config: ConfigQr): number[] {
  const bytes = codificador.encode(texto);
  if (bytes.length > capacidadBytes(config)) {
    throw new Error(`qr: ${bytes.length} bytes no entran en ${config.version}-${config.nivel}`);
  }

  const bits = new Bits();
  bits.push(0b0100, 4); // indicador de modo byte
  bits.push(bytes.length, 8); // contador de caracteres, 8 bits en version 1-9
  for (const b of bytes) bits.push(b, 8);

  return empaquetar(bits, config);
}

/** La configuracion mas chica donde entra el texto, o null si no entra en ninguna. */
export function configParaTexto(texto: string): ConfigQr | null {
  const largo = codificador.encode(texto).length;
  return CONFIGS.find((c) => largo <= capacidadBytes(c)) ?? null;
}

// --- Matriz ------------------------------------------------------------------

type Matriz = boolean[][];

function matrizVacia(size: number): { modulos: Matriz; reservado: boolean[][] } {
  const modulos: Matriz = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reservado = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { modulos, reservado };
}

function dibujarFinder(modulos: Matriz, reservado: boolean[][], size: number, fila0: number, col0: number): void {
  // Bloque 9x9 que incluye el separador blanco. Se recorta a la matriz porque
  // en los bordes el separador cae afuera.
  for (let df = -1; df <= 7; df++) {
    for (let dc = -1; dc <= 7; dc++) {
      const f = fila0 + df;
      const c = col0 + dc;
      if (f < 0 || f >= size || c < 0 || c >= size) continue;
      const dentroBorde = (df >= 0 && df <= 6 && (dc === 0 || dc === 6)) || (dc >= 0 && dc <= 6 && (df === 0 || df === 6));
      const dentroNucleo = df >= 2 && df <= 4 && dc >= 2 && dc <= 4;
      modulos[f][c] = dentroBorde || dentroNucleo;
      reservado[f][c] = true;
    }
  }
}

// Las versiones 2 a 6 llevan un unico patron de alineacion, centrado en
// (4*version + 10, 4*version + 10). Los otros tres candidatos de la grilla caen
// encima de los finders y por eso no se dibujan. Desde la version 7 son varios
// y hace falta la tabla del estandar; esas versiones no estan soportadas.
function dibujarAlineacion(modulos: Matriz, reservado: boolean[][], version: number): void {
  if (version < 2) return;
  const centro = 4 * version + 10;
  for (let df = -2; df <= 2; df++) {
    for (let dc = -2; dc <= 2; dc++) {
      const f = centro + df;
      const c = centro + dc;
      // Anillo exterior oscuro, anillo intermedio claro, centro oscuro.
      modulos[f][c] = Math.max(Math.abs(df), Math.abs(dc)) !== 1;
      reservado[f][c] = true;
    }
  }
}

function dibujarPatronesFijos(modulos: Matriz, reservado: boolean[][], version: number): void {
  const size = tamanoQr(version);
  dibujarFinder(modulos, reservado, size, 0, 0);
  dibujarFinder(modulos, reservado, size, 0, size - 7);
  dibujarFinder(modulos, reservado, size, size - 7, 0);

  // Timing: fila 6 y columna 6, oscuro en los indices pares.
  for (let i = 8; i < size - 8; i++) {
    const oscuro = i % 2 === 0;
    modulos[6][i] = oscuro;
    reservado[6][i] = true;
    modulos[i][6] = oscuro;
    reservado[i][6] = true;
  }

  // Va despues del timing: el patron de alineacion lo pisa en su cruce y ese es
  // el orden que manda el estandar.
  dibujarAlineacion(modulos, reservado, version);

  // Zonas de la informacion de formato (se pintan al final, pero hay que
  // reservarlas antes de colocar datos).
  for (let i = 0; i <= 8; i++) {
    reservado[8][i] = true;
    reservado[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reservado[8][size - 1 - i] = true;
    reservado[size - 1 - i][8] = true;
  }

  // Modulo oscuro fijo en (4 * version + 9, 8).
  modulos[4 * version + 9][8] = true;
  reservado[4 * version + 9][8] = true;
}

function mascara(patron: number, fila: number, col: number): boolean {
  switch (patron) {
    case 0: return (fila + col) % 2 === 0;
    case 1: return fila % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (fila + col) % 3 === 0;
    case 4: return (Math.floor(fila / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((fila * col) % 2) + ((fila * col) % 3) === 0;
    case 6: return (((fila * col) % 2) + ((fila * col) % 3)) % 2 === 0;
    default: return (((fila + col) % 2) + ((fila * col) % 3)) % 2 === 0;
  }
}

function colocarDatos(modulos: Matriz, reservado: boolean[][], bits: number[], patron: number): void {
  const size = modulos.length;
  let idx = 0;
  let subiendo = true;
  for (let col = size - 1; col > 0; col -= 2) {
    // La columna 6 es el timing vertical: se saltea entera.
    if (col === 6) col = 5;
    for (let i = 0; i < size; i++) {
      const fila = subiendo ? size - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const c = col - d;
        if (reservado[fila][c]) continue;
        // Los modulos que sobran despues de los codewords son los "remainder
        // bits" de las versiones 2 a 6: van en cero, enmascarados igual.
        const bit = idx < bits.length ? bits[idx] === 1 : false;
        idx++;
        modulos[fila][c] = bit !== mascara(patron, fila, c);
      }
    }
    subiendo = !subiendo;
  }
}

/** BCH(15,5) de la informacion de formato. L = 0b01, M = 0b00. */
function bitsFormato(patron: number, nivel: 'L' | 'M'): number {
  const datos = ((nivel === 'L' ? 0b01 : 0b00) << 3) | patron;
  let resto = datos;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >> 9) * 0x537);
  return ((datos << 10) | resto) ^ 0x5412;
}

function dibujarFormato(modulos: Matriz, patron: number, nivel: 'L' | 'M'): void {
  const size = modulos.length;
  const bits = bitsFormato(patron, nivel);
  const bit = (i: number) => ((bits >> i) & 1) === 1;

  // Copia junto al finder superior izquierdo.
  for (let i = 0; i <= 5; i++) modulos[i][8] = bit(i);
  modulos[7][8] = bit(6);
  modulos[8][8] = bit(7);
  modulos[8][7] = bit(8);
  for (let i = 9; i < 15; i++) modulos[8][14 - i] = bit(i);

  // Copia repartida entre los otros dos finders.
  for (let i = 0; i < 8; i++) modulos[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modulos[size - 15 + i][8] = bit(i);
}

// --- Eleccion de mascara -----------------------------------------------------
// Las cuatro reglas de penalizacion del estandar. Elegir mal la mascara no
// vuelve ilegible el codigo (cualquiera de las 8 decodifica), solo lo hace mas
// dificil de leer para el escaner; por eso vale la pena, y por eso tampoco es
// critico si una regla queda aproximada.

const PATRON_FINDER = [true, false, true, true, true, false, true, false, false, false, false];

function coincide(linea: boolean[], desde: number, patron: boolean[]): boolean {
  for (let i = 0; i < patron.length; i++) {
    if (linea[desde + i] !== patron[i]) return false;
  }
  return true;
}

function penalizacion(modulos: Matriz): number {
  const size = modulos.length;
  let total = 0;

  const lineas: boolean[][] = [];
  for (let f = 0; f < size; f++) lineas.push(modulos[f].slice());
  for (let c = 0; c < size; c++) lineas.push(modulos.map((fila) => fila[c]));

  for (const linea of lineas) {
    // Regla 1: rachas de 5 o mas del mismo color.
    let racha = 1;
    for (let i = 1; i < linea.length; i++) {
      if (linea[i] === linea[i - 1]) {
        racha++;
      } else {
        if (racha >= 5) total += 3 + (racha - 5);
        racha = 1;
      }
    }
    if (racha >= 5) total += 3 + (racha - 5);

    // Regla 3: el patron 1011101 con 4 modulos claros a un lado.
    for (let i = 0; i + PATRON_FINDER.length <= linea.length; i++) {
      if (coincide(linea, i, PATRON_FINDER)) total += 40;
      if (coincide(linea, i, PATRON_FINDER.slice().reverse())) total += 40;
    }
  }

  // Regla 2: bloques 2x2 del mismo color.
  for (let f = 0; f < size - 1; f++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modulos[f][c];
      if (v === modulos[f][c + 1] && v === modulos[f + 1][c] && v === modulos[f + 1][c + 1]) total += 3;
    }
  }

  // Regla 4: desbalance entre modulos oscuros y claros.
  let oscuros = 0;
  for (const fila of modulos) for (const v of fila) if (v) oscuros++;
  const porcentaje = (oscuros * 100) / (size * size);
  total += Math.floor(Math.abs(porcentaje - 50) / 5) * 10;

  return total;
}

// --- API ---------------------------------------------------------------------

/** Codewords (datos + ecc) -> matriz, probando las 8 mascaras y quedandose con la mejor. */
function armarMatriz(codewords: number[], config: ConfigQr): Matriz {
  const bits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }

  let mejor: Matriz | null = null;
  let mejorPuntaje = Infinity;
  for (let patron = 0; patron < 8; patron++) {
    const { modulos, reservado } = matrizVacia(tamanoQr(config.version));
    dibujarPatronesFijos(modulos, reservado, config.version);
    colocarDatos(modulos, reservado, bits, patron);
    dibujarFormato(modulos, patron, config.nivel);
    const puntaje = penalizacion(modulos);
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = modulos;
    }
  }

  return mejor as Matriz;
}

/**
 * Matriz de modulos del QR de un numero, en 1-M (21x21). `true` = oscuro. Sin
 * zona tranquila; el que dibuja decide cuanto margen deja (el estandar pide 4
 * modulos, y el SVG del componente los agrega).
 */
export function qrMatrizNumerica(digitos: string): boolean[][] {
  const datos = codewordsDatosNumericos(digitos);
  return armarMatriz(datos.concat(codewordsEcc(datos, CONFIG_NUMERICA.ecc)), CONFIG_NUMERICA);
}

/**
 * Matriz de modulos del QR de un texto arbitrario (modo byte), en la version
 * mas chica donde entre. Es lo que usa la URL de emparejamiento.
 *
 * Lanza si el texto pasa QR_MAX_BYTES: quien llama decide si eso es un error
 * duro o simplemente no dibujar el QR (la UI de pairing elige lo segundo, ver
 * OSDispositivos.tsx).
 */
export function qrMatrizTexto(texto: string): boolean[][] {
  const config = configParaTexto(texto);
  if (!config) {
    throw new Error(`qr: el texto pasa los ${QR_MAX_BYTES} bytes que soporta este encoder`);
  }
  const datos = codewordsDatosBytes(texto, config);
  return armarMatriz(datos.concat(codewordsEcc(datos, config.ecc)), config);
}

/**
 * Path SVG de los modulos oscuros, en una grilla de 1 unidad por modulo con el
 * origen desplazado por la zona tranquila. Un solo path en vez de un rect por
 * modulo.
 */
export function qrPathSvg(matriz: boolean[][], zonaTranquila = 4): string {
  const partes: string[] = [];
  for (let f = 0; f < matriz.length; f++) {
    for (let c = 0; c < matriz[f].length; c++) {
      if (matriz[f][c]) partes.push(`M${c + zonaTranquila} ${f + zonaTranquila}h1v1h-1z`);
    }
  }
  return partes.join('');
}
