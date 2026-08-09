import type { ItemBandeja } from './types';

export const bandeja: ItemBandeja[] = [
  {
    id: 'b1',
    titulo: 'Framework AI-native para legaltech — articulo a2r',
    url: 'https://a2r.io',
    descripcion: 'Relevante para propuesta Rafik. Leer antes del 26.',
    deadline: '2026-06-26',
    categoria: 'articulo',
    leido: false,
    fecha_captura: '2026-06-20',
  },
  {
    id: 'b2',
    titulo: 'Decidir estructura legal ELAB',
    descripcion: 'Necesito consultar con abogado esta semana. Tiene implicaciones fiscales para Q3.',
    deadline: '2026-07-01',
    categoria: 'decision',
    leido: false,
    fecha_captura: '2026-06-18',
  },
  {
    id: 'b3',
    titulo: 'Beehiiv API docs — integrar newsletter en Kit signup',
    url: 'https://developers.beehiiv.com',
    descripcion: 'TODO en el endpoint /api/kit-signup. Conectar al momento del formulario.',
    categoria: 'recurso',
    leido: false,
    fecha_captura: '2026-06-15',
  },
  {
    id: 'b4',
    titulo: 'Reporte suscriptores Resend — junio',
    descripcion: 'Analizar tasa de apertura del newsletter antes de escribir el siguiente numero.',
    deadline: '2026-06-28',
    categoria: 'tarea',
    leido: true,
    fecha_captura: '2026-06-21',
  },
];
