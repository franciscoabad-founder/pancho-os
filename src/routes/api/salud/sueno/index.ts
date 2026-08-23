// Server route de /api/salud/sueno, portada de
// src/pages/api/salud/sueno/index.ts (Astro) a TanStack Start.
//
// El archivo se llama sueno/index.ts y no sueno.ts a proposito: con index el
// directorio queda como puro segmento de ruta y /api/salud/sueno sale como hoja
// hermana de sueno/hoy, sueno/config y sueno/cafeina, que es exactamente el
// arbol que tenia Astro. Un sueno.ts al lado del directorio lo convertiria en
// ruta padre de las otras tres.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../../server/osAuth.ts';
import { noAutorizado, respuestaSalud } from '../../../../server/saludHttp.ts';
import {
  eliminarSesionSueno,
  guardarSesionesSueno,
  listarSesionesSueno,
} from '../../../../server/suenoSesiones.handlers.ts';

export const Route = createFileRoute('/api/salud/sueno/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const { searchParams } = new URL(request.url);
        try {
          const sesiones = await listarSesionesSueno({
            desde: searchParams.get('desde'),
            hasta: searchParams.get('hasta'),
          });
          return json({ sesiones });
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          return json(await guardarSesionesSueno(await request.json()));
        } catch (err) {
          return respuestaSalud(err);
        }
      },

      DELETE: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return json({ error: 'id requerido' }, 400);
        try {
          await eliminarSesionSueno(id);
          return json({ ok: true });
        } catch (err) {
          return respuestaSalud(err);
        }
      },
    },
  },
});
