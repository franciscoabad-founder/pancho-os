import type { DatosSalud } from './types';

export const datosSalud: DatosSalud = {
  fecha: '2026-06-22',

  identidad: 'Soy alguien que se mueve.',
  filosofia: 'Movimiento diario hasta 1.5h, en cualquier lugar. Mido la racha, no la bascula.',
  reglas: [
    'Movimiento diario: hasta 1.5h, en cualquier lugar.',
    'Mido la racha, no la bascula.',
    'Nunca dos dias seguidos sin moverme.',
  ],

  pasos: 7840,
  pasos_meta: 10000,
  sueno_horas: 7.2,
  sueno_meta: 7.5,
  peso_kg: 78.4,
  agua_litros: 1.8,
  agua_meta: 2.5,

  habitos: [
    { id: 'h1', label: 'Movimiento hoy',         completado: true,  racha: 5  },
    { id: 'h2', label: 'Sin alcohol',             completado: true,  racha: 14 },
    { id: 'h3', label: 'Lectura 20 min',          completado: false, racha: 3  },
    { id: 'h4', label: 'Meditacion o respiracion', completado: true, racha: 8  },
    { id: 'h5', label: 'Sin celular primera hora', completado: true, racha: 12 },
    { id: 'h6', label: 'Cena antes de las 20:00', completado: false, racha: 0  },
  ],
};
