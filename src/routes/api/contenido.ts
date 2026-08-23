// Server route de /api/contenido, portada de src/pages/api/contenido.ts (hoy
// src/organs/contenido/server/ideas.handlers.ts).
//
// Delgada a proposito, mismo patron que src/routes/api/tareas.ts: auth, parseo
// del Request y traduccion de errores a status HTTP. Las reglas de negocio
// viven en el organo.
//
// El contrato HTTP se mantiene identico al de Astro (misma ruta, mismos verbos,
// `?id=` en PATCH/DELETE, mismas claves de respuesta: { ideas }, { idea },
// { ok }) para que OSContenido.tsx y OSContenidoEditor.tsx hablen con
// fetch('/api/contenido') sin conocer nada del framework.
//
// El middleware global (src/server/osAuthMiddleware.ts) deja pasar /api/ sin
// cookie de sesion a proposito: cada endpoint valida su propia auth. Aca esa
// auth es isOsAuthorized(), que acepta la cookie del navegador O un token de
// API (Bearer / X-OS-Token), igual que la version Astro.
//
// Esta ruta vive en src/routes/api/** y no dentro del organo porque el router
// de TanStack Start es basado en archivos: solo descubre rutas bajo src/routes.
// Es el punto de montaje HTTP del organo, la excepcion declarada en la regla de
// fronteras de eslint.config.js.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../server/osAuth.ts';
import {
  ErrorIdeas,
  actualizarIdea,
  crearIdea,
  eliminarIdea,
  listarIdeas,
  type CuerpoIdea,
} from '../../organs/contenido/server/ideas.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

// ErrorIdeas trae su propio status (400). Cualquier otra cosa es un fallo de
// Supabase o de red: 502, con el mismo mensaje que devolvia Astro via errMsg().
function respuestaError(err: unknown): Response {
  if (err instanceof ErrorIdeas) return json({ error: err.message }, err.status);
  const msg = err instanceof Error
    ? err.message
    : (err as { message?: string } | null)?.message ?? 'error desconocido';
  return json({ error: msg }, 502);
}

async function leerCuerpo(request: Request): Promise<CuerpoIdea> {
  const body = await request.json();
  return (body ?? {}) as CuerpoIdea;
}

const idDeQuery = (request: Request) => new URL(request.url).searchParams.get('id');

export const Route = createFileRoute('/api/contenido')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const status = new URL(request.url).searchParams.get('status');
          return json({ ideas: await listarIdeas(status) });
        } catch (err) {
          return respuestaError(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const idea = await crearIdea(await leerCuerpo(request));
          return json({ idea }, 201);
        } catch (err) {
          return respuestaError(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        // El id se valida antes de tocar el cuerpo, igual que en Astro: un
        // PATCH sin ?id= responde 400 'id requerido' aunque el JSON venga roto.
        const id = idDeQuery(request);
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          const idea = await actualizarIdea(id, await leerCuerpo(request));
          return json({ idea });
        } catch (err) {
          return respuestaError(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          await eliminarIdea(idDeQuery(request));
          return json({ ok: true });
        } catch (err) {
          return respuestaError(err);
        }
      },
    },
  },
});
