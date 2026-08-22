// Server route de tareas, portado de src/pages/api/tareas.ts (Astro).
//
// Es deliberadamente delgado: auth, parseo del Request y traduccion de errores a
// status HTTP. Las reglas de negocio viven en src/server/tareas.handlers.ts y se
// comparten con la server function del loader (src/utils/tareas.functions.ts).
//
// El contrato HTTP se mantiene identico al de Astro (mismas rutas, mismos
// verbos, mismos codigos y mismas claves de respuesta) justamente para que
// src/os/components/OSTareas.tsx siga funcionando con su fetch('/api/tareas')
// SIN tocar una linea del componente.
//
// El middleware global (src/server/osAuthMiddleware.ts) deja pasar /api/ sin
// cookie de sesion a proposito: cada endpoint valida su propia auth. Aca esa
// auth es isOsAuthorized(), que acepta la cookie del navegador O un token de
// API (Bearer / X-OS-Token), igual que la version Astro.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorTareas,
  actualizarTarea,
  crearTarea,
  eliminarTarea,
  listarTareas,
  type CuerpoTarea,
} from '../../server/tareas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// ErrorTareas trae su propio status (400 / 404). Cualquier otra cosa es un
// fallo de Supabase o de red: 502, con el mismo mensaje que devolvia Astro.
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorTareas) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? JSON.stringify(err);
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<CuerpoTarea> {
  const body = await request.json();
  return (body ?? {}) as CuerpoTarea;
}

export const Route = createFileRoute('/api/tareas')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          return json({ tareas: await listarTareas() });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const tarea = await crearTarea(await leerCuerpo(request));
          return json({ ok: true, tarea }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        try {
          const body = await leerCuerpo(request);
          // El id puede venir por query (?id=) o dentro del cuerpo, igual que en
          // Astro: OSTareas.tsx usa la query, otros clientes usan el cuerpo.
          const url = new URL(request.url);
          const id = url.searchParams.get('id') ?? (body.id === undefined || body.id === null ? null : String(body.id));
          const tarea = await actualizarTarea(id, body);
          return json({ ok: true, tarea });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!isOsAuthorized(request)) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        try {
          await eliminarTarea(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
