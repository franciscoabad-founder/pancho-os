// Server route de /api/taski/perfiles: estado de salud de Hermes en sus dos
// ejes, que son cosas distintas y hasta F2 estaban mezcladas.
//
//   `perfiles` -> los agentes reales (Alfred, Arazza, Nerio, Rafik, Taskr).
//                 Lo consume el chat del OS para agrupar los temas.
//   `nodos`    -> las maquinas (VPS, HomeLab, Laptop). Lo consume el cockpit
//                 tecnico, que sigue siendo una vista por maquina.
//
// La clave `perfiles` cambio de contenido en F2; `nodos` es la que conserva la
// forma que tenia antes.

import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { listarNodosHermes, listarPerfilesHermes } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/taski/perfiles')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();

        try {
          const [perfiles, nodos] = await Promise.all([listarPerfilesHermes(), listarNodosHermes()]);
          return json({ perfiles, nodos });
        } catch (err) {
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
