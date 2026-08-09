import type { IdeaContenido } from './types';

export const ideas: IdeaContenido[] = [
  {
    id: 'c1',
    titulo: 'Por que la IA no reemplaza el diagnostico operativo — lo amplifica',
    formato: 'hilo',
    idea_madre:
      'El cuello de botella de la IA es el diagnostico, no la tecnologia. Un directivo que no entiende sus procesos seguira perdido con IA.',
    repurposing: [
      'Hilo LinkedIn (6 tweets)',
      'Newsletter Desde Adentro #9',
      'Reel vertical Instagram — el error mas caro de las empresas con IA',
    ],
    status: 'en-produccion',
    plataformas: ['LinkedIn', 'Instagram', 'Newsletter'],
    fecha_target: '2026-06-25',
  },
  {
    id: 'c2',
    titulo: 'Lo que vi durante 6 meses dirigiendo una institucion de $10.000M',
    formato: 'articulo',
    idea_madre:
      'Reflexion desde adentro del IESS: lo que se aprende cuando eres responsable de 32.000 personas y un presupuesto de esa magnitud.',
    repurposing: [
      'Articulo largo en blog (draft guardado)',
      'Extractos para LinkedIn — 3 hilos distintos',
      'Material para charla "Liderazgo bajo presion"',
    ],
    status: 'idea',
    plataformas: ['Blog', 'LinkedIn'],
  },
  {
    id: 'c3',
    titulo: 'Mis 6 principios del OS personal — el sistema que me permite operar 7 frentes',
    formato: 'post',
    idea_madre:
      'Documentar mis principios como sistema. Que cada pieza encaje. Prueba de que el sistema puede escalar.',
    repurposing: ['Post LinkedIn — carrusel de 6 slides', 'Newsletter Desde Adentro #8'],
    status: 'en-produccion',
    plataformas: ['LinkedIn', 'Newsletter'],
    fecha_target: '2026-06-28',
  },
  {
    id: 'c4',
    titulo: 'Kit IA para finanzas — resultados del lanzamiento',
    formato: 'post',
    idea_madre:
      '340 descargas el primer dia. Que funciona y que aprendemos para el siguiente producto digital.',
    repurposing: ['Post de resultados en LinkedIn', 'Email a suscriptores del kit'],
    status: 'publicado',
    plataformas: ['LinkedIn', 'Email'],
  },
];
