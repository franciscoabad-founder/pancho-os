import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { obtenerEstado } from '../../../server/ikigai.handlers.ts';
import { enviarATaski, MAX_LARGO_MENSAJE, taskiConfigurado, validarPerfil } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

function contextoSeguro(estado: Awaited<ReturnType<typeof obtenerEstado>>): string {
  const mapa = estado.mapa ? { version: estado.mapa.version, titulo: estado.mapa.titulo, nota: estado.mapa.nota } : null;
  return JSON.stringify({
    mapa,
    items: estado.items.slice(0, 80).map((i) => ({ cuadrante: i.cuadrante, texto: i.texto.slice(0, 300) })),
    zonas: estado.zonas.slice(0, 40).map((z) => ({ nombre: z.nombre, cuadrantes: z.cuadrantes, descripcion: z.descripcion?.slice(0, 300), clasificacion: z.clasificacion })),
    cobertura: estado.cobertura,
  });
}

export const Route = createFileRoute('/api/ikigai/iterar')({
  server: { handlers: {
    POST: async ({ request }) => {
      if (!(await isOsAuthorized(request))) return noAutorizado();
      if (!taskiConfigurado()) return json({ error: 'TASKI_TOKEN no configurado' }, 503);
      try {
        const raw = await request.json().catch(() => ({})) as Record<string, unknown>;
        const perfil = validarPerfil(typeof raw.profile_id === 'string' ? raw.profile_id.trim() : 'vps-default');
        const estado = await obtenerEstado();
        const contexto = contextoSeguro(estado);
        const prompt = [
          'Actúa como coach estratégico del módulo Ikigai de Pancho OS.',
          'Analiza exclusivamente el contexto JSON delimitado abajo.',
          'Devuelve 3-5 sugerencias concretas de zonas, preguntas o ajustes de cuadrantes.',
          'No inventes hechos, no ejecutes acciones y no pidas credenciales.',
          'Formato: lista numerada breve, indicando si es zona nueva, ajuste o pregunta.',
          '--- CONTEXTO IKIGAI JSON ---', contexto, '--- FIN CONTEXTO ---',
        ].join('\n').slice(0, MAX_LARGO_MENSAJE);
        const respuesta = await enviarATaski(prompt, 'ikigai-iteration', perfil);
        return json({ ok: true, perfil, sugerencias: respuesta, mapa_version: estado.mapa?.version ?? null });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 502);
      }
    },
  } },
});
