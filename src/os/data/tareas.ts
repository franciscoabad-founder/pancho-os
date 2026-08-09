import type { Tarea } from './types';

export const tareas: Tarea[] = [
  { id: 't1', label: 'Cerrar propuesta Rafik expansion USA', proyecto: 'BrainTech', prioridad: 'alta', status: 'en-curso', deadline: '2026-06-26' },
  { id: 't2', label: 'Preparar kick-off MegaRetail — 1 jul', proyecto: 'BrainTech', prioridad: 'alta', status: 'pendiente', deadline: '2026-07-01' },
  { id: 't3', label: 'Documentar proceso de onboarding cliente', proyecto: 'BrainTech', prioridad: 'media', status: 'pendiente' },
  { id: 't4', label: 'Actualizar deck de ventas con caso retail', proyecto: 'BrainTech', prioridad: 'media', status: 'pendiente' },
  { id: 't5', label: 'Publicar hilo LinkedIn IA en finanzas', proyecto: 'Marca personal', prioridad: 'alta', status: 'en-curso' },
  { id: 't6', label: 'Escribir newsletter "Desde Adentro" #8', proyecto: 'Marca personal', prioridad: 'media', status: 'pendiente', deadline: '2026-06-28' },
  { id: 't7', label: 'Actualizar foto de perfil LinkedIn', proyecto: 'Marca personal', prioridad: 'baja', status: 'pendiente' },
  { id: 't8', label: 'Revisar wireframes MVP con equipo', proyecto: 'taskr', prioridad: 'alta', status: 'pendiente' },
  { id: 't9', label: 'Definir stack tecnologico para beta privada', proyecto: 'taskr', prioridad: 'media', status: 'pendiente' },
  { id: 't10', label: 'Confirmar agenda reunion CODEIS julio', proyecto: 'CODEIS', prioridad: 'alta', status: 'en-curso', deadline: '2026-06-25' },
  { id: 't11', label: 'Contactar speaker para evento agosto', proyecto: 'CODEIS', prioridad: 'media', status: 'pendiente', deadline: '2026-07-01' },
  { id: 't12', label: 'Revisar estructura legal ELAB con abogado', proyecto: 'ELAB', prioridad: 'alta', status: 'pendiente', deadline: '2026-07-15' },
];
