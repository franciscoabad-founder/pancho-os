// Server functions de tareas. Mismo patron que el spike
// (C:\DEV\pancho-os-spike-tanstack\src\utils\tareas.functions.ts) pero contra la
// logica real: aca no se vuelve a escribir la consulta, se llama a
// src/server/tareas.handlers.ts, el mismo modulo que usa el server route
// /api/tareas.
//
// Que es una server function: el cuerpo del .handler() NUNCA se bundlea para el
// navegador. En SSR se ejecuta en proceso; desde el cliente se convierte en un
// POST a /_serverFn/... El import de tareas.handlers.ts (y con el, la service
// role key de Supabase) queda del lado servidor por construccion.

import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { isOsAuthorized } from '../server/osAuth.ts';
import { listarTareas, type Tarea } from '../server/tareas.handlers.ts';

export interface ResumenTareas {
  tareas: Tarea[];
  /** Milisegundos que tardo la consulta a Supabase, medidos en el servidor. */
  serverMs: number;
}

export const getTareas = createServerFn({ method: 'GET' }).handler(async (): Promise<ResumenTareas> => {
  // El acceso ya lo corta el middleware global (src/server/osAuthMiddleware.ts:
  // una server function sin sesion recibe 401 antes de llegar hasta aca). Esta
  // segunda verificacion es defensa en profundidad: si alguien agrega /tareas o
  // el prefijo de server functions a la lista publica por error, la consulta a
  // Supabase sigue sin ejecutarse.
  if (!isOsAuthorized(getRequest())) {
    throw new Error('Unauthorized');
  }

  const t0 = Date.now();
  const tareas = await listarTareas();
  return { tareas, serverMs: Date.now() - t0 };
});
