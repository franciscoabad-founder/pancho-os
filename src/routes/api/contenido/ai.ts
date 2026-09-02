import { createFileRoute } from '@tanstack/react-router';
import { isOsAuthorized, json } from '../../../server/osAuth.ts';
import { enviarATaski } from '../../../server/taski.handlers.ts';

const noAutorizado = () => json({ error: 'Unauthorized' }, 401);

export const Route = createFileRoute('/api/contenido/ai')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isOsAuthorized(request))) return noAutorizado();
        try {
          const body = await request.json();
          const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
          const cuerpo = typeof body.cuerpo === 'string' ? body.cuerpo.trim() : '';

          if (!titulo && !cuerpo) {
            return json({ error: 'Se requiere titulo o cuerpo' }, 400);
          }

          const prompt = `Actua como un experto en creacion de contenido y copywriting para redes sociales (LinkedIn, Instagram, Twitter).
Tengo el siguiente borrador de un post.
Titulo/Hook original: "${titulo}"
Cuerpo original: "${cuerpo}"

Tu tarea es devolver 3 variantes mejoradas de este post. Cada variante debe tener un estilo diferente:
Variante 1: Directa y al grano, enfocada en el valor.
Variante 2: Storytelling, enfocada en conectar emocionalmente.
Variante 3: Polemica o contrarian, para generar debate.

Para cada variante, proporciona:
1. Un hook (titulo) fuerte y atractivo.
2. El cuerpo del post mejorado, bien estructurado y facil de leer.

Responde SOLO en formato JSON con la siguiente estructura:
{
  "variantes": [
    { "estilo": "Directa", "hook": "...", "cuerpo": "..." },
    { "estilo": "Storytelling", "hook": "...", "cuerpo": "..." },
    { "estilo": "Polemica", "hook": "...", "cuerpo": "..." }
  ]
}`;

          // Usamos el perfil por defecto y un timeout largo ya que la IA puede tardar
          const respuestaIA = await enviarATaski(prompt, 'os-contenido-ai', 'vps-default', 120_000);

          let resultadoJson;
          try {
            // Intentar extraer JSON si la IA incluye markdown
            const match = respuestaIA.match(/```json\n([\s\S]*?)\n```/) || respuestaIA.match(/```\n([\s\S]*?)\n```/);
            if (match && match[1]) {
                resultadoJson = JSON.parse(match[1]);
            } else {
                resultadoJson = JSON.parse(respuestaIA);
            }
          } catch (parseError) {
             console.error("Error parseando respuesta de IA:", respuestaIA);
             return json({ error: 'La IA no devolvio un formato JSON valido', raw: respuestaIA }, 500);
          }

          return json(resultadoJson, 200);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
