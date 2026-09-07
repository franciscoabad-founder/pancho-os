// Parser SSE minimo y compartido por los dos extremos del streaming del chat.
//
//   - El server (src/server/taski.handlers.ts) lo usa para leer el stream del
//     api_server de Hermes (POST /api/sessions/{id}/chat/stream).
//   - El navegador (src/os/components/OSChat.tsx) lo usa para leer el stream
//     que el propio OS reemite en /api/chat/:id/stream.
//
// Vive en src/os/lib porque es codigo de presentacion reutilizable; que el
// server lo importe ya tiene precedente en el repo (src/os/lib/gbrain.ts lo
// usan cinco handlers). No depende del DOM: solo de ReadableStream y
// TextDecoder, que existen igual en Node 22 y en el navegador.
//
// Deliberadamente NO implementa el protocolo EventSource completo: no hay
// reconexion, ni `id:`, ni `retry:`. Solo lo que el chat necesita: bloques
// separados por linea en blanco, con `event:` y una o mas `data:`.

export interface TramaSse {
  /** Valor de `event:`. 'message' si el bloque no lo trae (spec SSE). */
  evento: string;
  /** Las lineas `data:` del bloque, unidas por salto de linea. */
  datos: string;
}

/**
 * Convierte un bloque crudo (sin la linea en blanco final) en una trama.
 * Devuelve null si el bloque solo tenia comentarios (`:` de keepalive) o
 * campos que no usamos.
 */
export function parsearBloqueSse(bloque: string): TramaSse | null {
  let evento = '';
  const datos: string[] = [];

  for (const linea of bloque.split(/\r?\n/)) {
    // Linea vacia o comentario (los keepalive de Caddy y de Hermes son `: ping`).
    if (!linea || linea.startsWith(':')) continue;
    const corte = linea.indexOf(':');
    const campo = corte < 0 ? linea : linea.slice(0, corte);
    let valor = corte < 0 ? '' : linea.slice(corte + 1);
    // La spec dice que se quita UN espacio despues de los dos puntos.
    if (valor.startsWith(' ')) valor = valor.slice(1);
    if (campo === 'event') evento = valor;
    else if (campo === 'data') datos.push(valor);
  }

  if (!evento && datos.length === 0) return null;
  return { evento: evento || 'message', datos: datos.join('\n') };
}

/**
 * Lee un cuerpo SSE hasta el final y llama a onTrama por cada bloque.
 *
 * Si onTrama tira, el error sube al llamador (y el reader queda liberado por
 * el finally), que es lo que queremos: un consumidor roto no debe dejar el
 * stream a medias en silencio.
 */
export async function leerSse(
  cuerpo: ReadableStream<Uint8Array>,
  onTrama: (trama: TramaSse) => void,
): Promise<void> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';

  const emitirBloques = (final: boolean) => {
    for (;;) {
      const separador = /\r?\n\r?\n/.exec(buffer);
      if (!separador) break;
      const bloque = buffer.slice(0, separador.index);
      buffer = buffer.slice(separador.index + separador[0].length);
      const trama = parsearBloqueSse(bloque);
      if (trama) onTrama(trama);
    }
    // Al cerrar, un ultimo bloque sin linea en blanco final igual cuenta: hay
    // servidores que cortan la conexion justo despues del ultimo `data:`.
    if (final && buffer.trim()) {
      const trama = parsearBloqueSse(buffer);
      buffer = '';
      if (trama) onTrama(trama);
    }
  };

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true });
      emitirBloques(false);
    }
    buffer += decodificador.decode();
    emitirBloques(true);
  } finally {
    try {
      lector.releaseLock();
    } catch {
      // El lector ya estaba liberado (stream cancelado): no hay nada que hacer.
    }
  }
}

/** Serializa una trama SSE lista para escribir en la respuesta. */
export function formatearSse(evento: string, datos: unknown): string {
  const cuerpo = typeof datos === 'string' ? datos : JSON.stringify(datos ?? {});
  // Cada salto de linea del payload necesita su propia linea `data:`.
  const lineas = cuerpo.split('\n').map((l) => `data: ${l}`).join('\n');
  return `event: ${evento}\n${lineas}\n\n`;
}
