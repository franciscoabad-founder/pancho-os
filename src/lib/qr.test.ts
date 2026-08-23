// Contrato del encoder de QR minimo. Un QR mal armado no se nota mirandolo:
// se ve como un QR valido y ningun telefono lo lee. Por eso los primeros tests
// van contra el vector canonico de ISO/IEC 18004 para "01234567" en 1-M, que es
// el ejemplo que usa toda la literatura del estandar, y el resto verifica
// propiedades que solo se cumplen si la matriz esta bien armada.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONFIG_NUMERICA,
  QR_MAX_BYTES,
  QR_SIZE,
  codewordsDatosBytes,
  codewordsDatosNumericos,
  codewordsEcc,
  configParaTexto,
  qrMatrizNumerica,
  qrMatrizTexto,
  qrPathSvg,
  tamanoQr,
} from './qr.ts';

// --- vector canonico --------------------------------------------------------

test('codewordsDatosNumericos reproduce el vector canonico de "01234567"', () => {
  assert.deepEqual(
    codewordsDatosNumericos('01234567'),
    [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11],
  );
});

test('codewordsEcc reproduce los 10 codewords de correccion del vector canonico', () => {
  const datos = codewordsDatosNumericos('01234567');
  assert.deepEqual(
    codewordsEcc(datos, 10),
    [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55],
  );
});

test('el relleno completa siempre 16 codewords de datos', () => {
  for (const entrada of ['0', '482913', '01234567', '1234567890123456789012345678901234']) {
    assert.equal(codewordsDatosNumericos(entrada).length, 16, `fallo con ${entrada}`);
  }
});

// Propiedad que define a Reed-Solomon: el polinomio completo (datos seguidos de
// su ECC) es divisible por el generador, o sea que su resto es cero. Vale para
// cualquier cantidad de codewords de correccion, asi que cubre de una las cinco
// configuraciones soportadas, no solo la del vector canonico.
test('datos + ecc siempre da resto cero contra el generador', () => {
  for (const cantidad of [10, 16, 20, 26]) {
    const datos = codewordsDatosBytes('https://os.franciscoabad.com/pair/x', { version: 5, nivel: 'L', datos: 108, ecc: cantidad });
    const ecc = codewordsEcc(datos, cantidad);
    const resto = codewordsEcc(datos.concat(ecc), cantidad);
    assert.deepEqual(resto, new Array(cantidad).fill(0), `resto no nulo con ${cantidad} codewords`);
  }
});

// --- modo byte --------------------------------------------------------------

test('codewordsDatosBytes arma la cabecera de modo byte a mano', () => {
  // 0100 (modo byte) + 00000010 (2 caracteres) + 'A' (0x41) + 'B' (0x42) +
  // 0000 (terminador) = 0x40 0x24 0x14 0x20, y despues el relleno alternado.
  const cw = codewordsDatosBytes('AB', CONFIG_NUMERICA);
  assert.equal(cw.length, 16);
  assert.deepEqual(cw.slice(0, 4), [0x40, 0x24, 0x14, 0x20]);
  assert.deepEqual(cw.slice(4, 8), [0xec, 0x11, 0xec, 0x11]);
});

test('configParaTexto elige la version mas chica donde entra', () => {
  assert.equal(configParaTexto('hola')?.version, 1);
  assert.equal(configParaTexto('x'.repeat(14))?.version, 1);
  assert.equal(configParaTexto('x'.repeat(15))?.version, 2);
  assert.equal(configParaTexto('x'.repeat(26))?.version, 2);
  assert.equal(configParaTexto('x'.repeat(27))?.version, 3);
  assert.equal(configParaTexto('x'.repeat(43))?.version, 4);
  assert.equal(configParaTexto('x'.repeat(79))?.version, 5);
  assert.equal(configParaTexto('x'.repeat(QR_MAX_BYTES)) !== null, true);
  assert.equal(configParaTexto('x'.repeat(QR_MAX_BYTES + 1)), null);
});

test('la URL de pairing real entra y arma una matriz de la version esperada', () => {
  // 33 caracteres de origen + '/pair/' + un uuid de 36 = 70 bytes: 4-L.
  const url = 'https://os.franciscoabad.com/pair/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0';
  assert.equal(url.length, 70);
  const config = configParaTexto(url);
  assert.equal(config?.version, 4);
  assert.equal(qrMatrizTexto(url).length, tamanoQr(4));
});

test('qrMatrizTexto lanza si el texto no entra en ninguna configuracion', () => {
  assert.throws(() => qrMatrizTexto('x'.repeat(QR_MAX_BYTES + 1)), /bytes/);
});

// --- forma de la matriz -----------------------------------------------------

test('la matriz numerica es 21x21', () => {
  const m = qrMatrizNumerica('482913');
  assert.equal(m.length, QR_SIZE);
  for (const fila of m) assert.equal(fila.length, QR_SIZE);
});

test('tamanoQr sigue la formula del estandar', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(tamanoQr), [21, 25, 29, 33, 37]);
});

// Las mismas invariantes estructurales, ahora sobre las cinco versiones: un
// error de indice al parametrizar el tamaño se ve aca y no en un telefono.
const MATRICES: Array<[string, boolean[][], number]> = [
  ['numerica 1-M', qrMatrizNumerica('482913'), 1],
  ['byte v1', qrMatrizTexto('hola'), 1],
  ['byte v2', qrMatrizTexto('x'.repeat(20)), 2],
  ['byte v3', qrMatrizTexto('x'.repeat(40)), 3],
  ['byte v4', qrMatrizTexto('x'.repeat(70)), 4],
  ['byte v5', qrMatrizTexto('x'.repeat(100)), 5],
];

test('los tres finder patterns estan en su lugar en todas las versiones', () => {
  for (const [nombre, m, version] of MATRICES) {
    const size = tamanoQr(version);
    assert.equal(m.length, size, nombre);
    for (const [f0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
      // Anillo exterior oscuro, anillo interior claro, nucleo 3x3 oscuro.
      assert.equal(m[f0][c0], true, nombre);
      assert.equal(m[f0 + 1][c0 + 1], false, nombre);
      assert.equal(m[f0 + 3][c0 + 3], true, nombre);
      assert.equal(m[f0 + 6][c0 + 6], true, nombre);
    }
  }
});

test('los patrones de timing alternan desde los finders en todas las versiones', () => {
  for (const [nombre, m, version] of MATRICES) {
    const size = tamanoQr(version);
    for (let i = 8; i < size - 8; i++) {
      assert.equal(m[6][i], i % 2 === 0, `${nombre}: timing horizontal roto en ${i}`);
      assert.equal(m[i][6], i % 2 === 0, `${nombre}: timing vertical roto en ${i}`);
    }
  }
});

test('el modulo oscuro fijo esta en (4*version + 9, 8)', () => {
  for (const [nombre, m, version] of MATRICES) {
    assert.equal(m[4 * version + 9][8], true, nombre);
  }
});

test('el separador blanco rodea el finder superior izquierdo', () => {
  for (const [nombre, m] of MATRICES) {
    for (let i = 0; i <= 7; i++) {
      assert.equal(m[7][i], false, `${nombre}: separador horizontal roto en ${i}`);
      assert.equal(m[i][7], false, `${nombre}: separador vertical roto en ${i}`);
    }
  }
});

test('las versiones 2 a 5 llevan su patron de alineacion y la 1 no', () => {
  for (const [nombre, m, version] of MATRICES) {
    if (version < 2) continue;
    const centro = 4 * version + 10;
    assert.equal(m[centro][centro], true, `${nombre}: centro del patron de alineacion`);
    // Anillo intermedio claro en las cuatro direcciones.
    assert.equal(m[centro - 1][centro], false, nombre);
    assert.equal(m[centro + 1][centro], false, nombre);
    assert.equal(m[centro][centro - 1], false, nombre);
    assert.equal(m[centro][centro + 1], false, nombre);
    // Anillo exterior oscuro.
    assert.equal(m[centro - 2][centro - 2], true, nombre);
    assert.equal(m[centro + 2][centro + 2], true, nombre);
  }
});

// --- comportamiento general -------------------------------------------------

test('codigos distintos dan matrices distintas', () => {
  const a = JSON.stringify(qrMatrizNumerica('482913'));
  const b = JSON.stringify(qrMatrizNumerica('482914'));
  assert.notEqual(a, b);
});

test('el mismo codigo da siempre la misma matriz', () => {
  assert.equal(JSON.stringify(qrMatrizNumerica('000123')), JSON.stringify(qrMatrizNumerica('000123')));
});

test('textos distintos dan matrices distintas', () => {
  const a = JSON.stringify(qrMatrizTexto('https://os.franciscoabad.com/pair/aaa'));
  const b = JSON.stringify(qrMatrizTexto('https://os.franciscoabad.com/pair/aab'));
  assert.notEqual(a, b);
});

test('rechaza entradas que no son digitos y las que exceden la capacidad', () => {
  assert.throws(() => qrMatrizNumerica('abc'), /solo se admiten digitos/);
  assert.throws(() => qrMatrizNumerica('12-34'), /solo se admiten digitos/);
  assert.throws(() => qrMatrizNumerica('1'.repeat(35)), /maximo 34 digitos/);
});

test('qrPathSvg dibuja un rect por modulo oscuro, desplazado por la zona tranquila', () => {
  const matriz = [[true, false], [false, true]];
  assert.equal(qrPathSvg(matriz, 0), 'M0 0h1v1h-1zM1 1h1v1h-1z');
  assert.equal(qrPathSvg(matriz, 4), 'M4 4h1v1h-1zM5 5h1v1h-1z');
});

// --- ida y vuelta -----------------------------------------------------------
//
// El test que de verdad importa: un lector escrito aparte, que no comparte una
// linea con el encoder, saca el texto de vuelta de la matriz. Las invariantes
// estructurales de arriba dicen que el QR "tiene forma de QR"; esto dice que un
// escaner lo puede leer. Deshace la mascara leyendola de la informacion de
// formato, recorre la zigzag y desarma la cabecera de modo byte.

function mascaraDeReferencia(p: number, f: number, c: number): boolean {
  switch (p) {
    case 0: return (f + c) % 2 === 0;
    case 1: return f % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (f + c) % 3 === 0;
    case 4: return (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((f * c) % 2) + ((f * c) % 3) === 0;
    case 6: return (((f * c) % 2) + ((f * c) % 3)) % 2 === 0;
    default: return (((f + c) % 2) + ((f * c) % 3)) % 2 === 0;
  }
}

/** Que celdas NO llevan datos, deducido de la version y nada mas. */
function mapaReservado(size: number, version: number): boolean[][] {
  const r = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const bloque = (f0: number, c0: number, lado: number) => {
    for (let f = f0; f < f0 + lado; f++) {
      for (let c = c0; c < c0 + lado; c++) {
        if (f >= 0 && f < size && c >= 0 && c < size) r[f][c] = true;
      }
    }
  };
  bloque(0, 0, 8);
  bloque(0, size - 8, 8);
  bloque(size - 8, 0, 8);
  for (let i = 0; i < size; i++) {
    r[6][i] = true;
    r[i][6] = true;
  }
  for (let i = 0; i <= 8; i++) {
    r[8][i] = true;
    r[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    r[8][size - 1 - i] = true;
    r[size - 1 - i][8] = true;
  }
  r[4 * version + 9][8] = true;
  if (version >= 2) bloque(4 * version + 8, 4 * version + 8, 5);
  return r;
}

/** Los 3 bits de mascara, sacados de la copia de formato del finder superior izquierdo. */
function mascaraDeLaMatriz(m: boolean[][]): number {
  const bit: boolean[] = [];
  for (let i = 0; i <= 5; i++) bit[i] = m[i][8];
  bit[6] = m[7][8];
  bit[7] = m[8][8];
  bit[8] = m[8][7];
  for (let i = 9; i < 15; i++) bit[i] = m[8][14 - i];
  let v = 0;
  for (let i = 0; i < 15; i++) if (bit[i]) v |= 1 << i;
  return ((v ^ 0x5412) >> 10) & 0b111;
}

function leerQrByte(m: boolean[][]): string {
  const size = m.length;
  const version = (size - 17) / 4;
  const reservado = mapaReservado(size, version);
  const patron = mascaraDeLaMatriz(m);

  const bits: number[] = [];
  let subiendo = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let i = 0; i < size; i++) {
      const fila = subiendo ? size - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const c = col - d;
        if (reservado[fila][c]) continue;
        bits.push(m[fila][c] !== mascaraDeReferencia(patron, fila, c) ? 1 : 0);
      }
    }
    subiendo = !subiendo;
  }

  const leer = (desde: number, n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bits[desde + i];
    return v;
  };
  assert.equal(leer(0, 4), 0b0100, 'indicador de modo byte');
  const largo = leer(4, 8);
  const bytes: number[] = [];
  for (let i = 0; i < largo; i++) bytes.push(leer(12 + i * 8, 8));
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

test('un lector independiente recupera el texto de la matriz en las 5 versiones', () => {
  for (const texto of [
    'hola',
    'x'.repeat(20),
    'x'.repeat(40),
    'http://localhost:3000/pair/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
    'https://os.franciscoabad.com/pair/0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
    'x'.repeat(QR_MAX_BYTES),
  ]) {
    assert.equal(leerQrByte(qrMatrizTexto(texto)), texto, `no se pudo releer: ${texto.slice(0, 24)}`);
  }
});
