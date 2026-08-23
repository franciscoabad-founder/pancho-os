// Server route de /api/salud/meals, portada de src/pages/api/salud/meals.ts.
//
// El POST tiene dos ramas, igual que el original: con `log` registra el meal en
// comidas_log (201 { comidas, meal_id }); sin el, crea un meal reusable
// (201 { meal }).

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../server/saludHttp.ts';
import {
  actualizarMeal,
  crearMeal,
  eliminarMeal,
  leerMeals,
  registrarMeal,
} from '../../../server/saludMeals.handlers.ts';

export const Route = createFileRoute('/api/salud/meals')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const url = new URL(request.url);
        try {
          return json(await leerMeals({
            id: url.searchParams.get('id'),
            q: url.searchParams.get('q')?.trim() || '',
          }));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = await request.json();
          if (body.log) return json(await registrarMeal(body), 201);
          return json({ meal: await crearMeal(body) }, 201);
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      PATCH: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          return json({ meal: await actualizarMeal(id, await request.json()) });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarMeal(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
