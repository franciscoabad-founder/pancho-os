import type { NotaCerebro } from './types';

export const notas: NotaCerebro[] = [
  {
    id: 'n1',
    titulo: 'El diagnostico operativo como ventaja competitiva',
    resumen:
      'Las empresas que implementan IA sin diagnostico previo duplican sus errores mas rapido. El diagnostico operativo es el activo que BrainTech vende realmente.',
    tags: ['BrainTech', 'IA', 'estrategia', 'ventaja-competitiva'],
    fecha: '2026-06-20',
    conexiones: ['n3', 'n4'],
  },
  {
    id: 'n2',
    titulo: 'Principios del OS personal — borrador v3',
    resumen:
      '6 principios que gobiernan como opero: accion sobre perfeccion, un domino, lo incomodo primero, maker/manager separados, el sistema manda, contenido que compone.',
    tags: ['OS-personal', 'productividad', 'sistemas'],
    fecha: '2026-06-18',
    conexiones: ['n5'],
  },
  {
    id: 'n3',
    titulo: 'Lecciones IESS — eficiencia operativa sin tecnologia nueva',
    resumen:
      'Del 36 al 78% de eficiencia en 6 meses sin cambiar sistemas. La clave fue el diagnostico de procesos y la eliminacion de pasos sin valor.',
    tags: ['IESS', 'eficiencia', 'liderazgo', 'caso-de-estudio'],
    fecha: '2026-06-10',
    conexiones: ['n1'],
  },
  {
    id: 'n4',
    titulo: 'Modelo de negocio BrainTech — iteracion Q2 2026',
    resumen:
      'Retainer mensual por diagnostico + implementacion. Ticket promedio $5-8k/mes. Clientes objetivo: empresas 50-500 empleados en legaltech, fintech y retail.',
    tags: ['BrainTech', 'modelo-negocio', 'pricing'],
    fecha: '2026-06-15',
    conexiones: ['n1'],
  },
];
