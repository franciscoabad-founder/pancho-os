import type { DatosDaily } from './types';

export const datosDaily: DatosDaily = {
  principios: [
    'Accion sobre perfeccion. Publico al 70%.',
    'Un domino al dia.',
    'Lo incomodo primero.',
    'Maker y Manager separados por dias enteros.',
    'El sistema es mi jefe, no mi animo.',
    'El contenido es ingreso que compone.',
  ],

  semana: [
    { dia: 'Lunes',    tipo: 'manager', descripcion: 'Manager en casa',  detalle: 'Planifico la semana, alineo socios' },
    { dia: 'Martes',   tipo: 'manager', descripcion: 'Manager, salir',   detalle: 'Reuniones, comercializar, tramites' },
    { dia: 'Miercoles',tipo: 'maker',   descripcion: 'Maker',            detalle: 'Crear y entregar' },
    { dia: 'Jueves',   tipo: 'manager', descripcion: 'Manager, salir',   detalle: 'Reuniones, tramites, comercializar' },
    { dia: 'Viernes',  tipo: 'maker',   descripcion: 'Maker + cierre',   detalle: 'Crear, entregar y revision semanal' },
    { dia: 'Sabado',   tipo: 'maker',   descripcion: 'Maker, contenido', detalle: 'Grabar y editar' },
    { dia: 'Domingo',  tipo: 'off',     descripcion: 'Off',              detalle: '' },
  ],

  rutina_am: [
    { id: 'am1', label: 'Despertar, agua, moverme',                          completado: false },
    { id: 'am2', label: 'Sin telefono hasta terminar la rutina',              completado: false },
    { id: 'am3', label: 'Brain dump: vaciar lo que ocupa espacio mental',     duracion: '5 min', completado: false },
    { id: 'am4', label: 'Definir el One Domino del dia y escribirlo',        duracion: '3 min', completado: false },
    { id: 'am5', label: 'Lo incomodo primero, antes que cualquier otra cosa', completado: false },
  ],

  check_10min: [
    '¿Sigo trabajando en mi One Domino?',
    '¿Hay algo que bloquea mi avance hoy?',
    '¿Necesito redirigir mi energia hacia otra prioridad?',
  ],

  pm_close: [
    { id: 'pm1', label: '¿Que sali hoy? Un resultado concreto',  completado: false },
    { id: 'pm2', label: 'Capturar un win del dia, por pequeno que sea', completado: false },
    { id: 'pm3', label: 'Definir el domino de manana',            completado: false },
  ],

  reglas: [
    'Regla de 2 minutos: la version minima cuenta. Hacer aunque sea poco.',
    'Regla innegociable: nunca fallo dos veces seguidas.',
  ],
};
