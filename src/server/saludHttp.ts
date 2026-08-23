// Traduccion de errores a status HTTP para los handlers del modulo Salud.
//
// Por que existe: las APIs de Salud portadas desde src/pages/api/salud/** son
// pesadas en validacion, y su contrato HTTP distingue con precision entre 400
// (el cliente mando algo invalido), 404, 413, 422, 501 y 502 (fallo aguas
// abajo, tipicamente Supabase). Al partir cada endpoint en "handler puro" +
// "server route delgada", esa distincion tenia que sobrevivir el viaje: en el
// original cada validacion era un `return json({...}, 400)` en el mismo cuerpo
// de la funcion.
//
// La solucion es que el handler lance ErrorHttp con el status exacto y la
// route lo traduzca con respuestaSalud(). Cualquier otro error (el que tira
// supabase-js, un fetch caido, un TypeError) cae al 502 de siempre, que es
// justo lo que hacia el `catch` del archivo Astro.
//
// El patron de src/server/objetivos.handlers.ts (lista de mensajes que valen
// 400) no se reuso a proposito: aca hay seis status distintos y decenas de
// mensajes, y una lista de strings paralela seria una fuente de bugs silenciosa
// el dia que alguien reformule un mensaje.

import { json } from './osAuth.ts';
import { errMsg } from '../lib/salud/apiHelpers.ts';

export class ErrorHttp extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.status = status;
  }
}

/** Atajo para el caso mas comun: validacion de entrada fallida. */
export const error400 = (mensaje: string) => new ErrorHttp(400, mensaje);

/**
 * Respuesta de error de un endpoint de Salud. ErrorHttp conserva su status; el
 * resto es 502 con el mensaje extraido por errMsg(), identico al Astro.
 */
export function respuestaSalud(err: unknown): Response {
  if (err instanceof ErrorHttp) return json({ error: err.message }, err.status);
  return json({ error: errMsg(err) }, 502);
}

export const noAutorizado = () => json({ error: 'Unauthorized' }, 401);
