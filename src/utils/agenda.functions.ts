import { createServerFn } from '@tanstack/react-start';
import { listarEventos } from '../server/agenda.handlers.ts';

export const getEventos = createServerFn({ method: 'GET' })
  .handler(async () => {
    const inicio = performance.now();
    const eventos = await listarEventos();
    return { eventos, serverMs: Math.round(performance.now() - inicio) };
  });
