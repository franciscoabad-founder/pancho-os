import type { DatosHoy } from './types';

export const datosHoy: DatosHoy = {
  fecha: '2026-06-22',
  domino: {
    tarea: 'Cerrar propuesta BrainTech para expansion USA de Rafik',
    proyecto: 'BrainTech / Rafik',
    razon: 'Esta propuesta desbloquea el contrato mas grande del trimestre',
  },
  discomfort: {
    tarea: 'Llamar a cliente con pago vencido 30 dias',
    contexto: 'Incomodo pero necesario. No cuesta mas de 10 minutos.',
  },
  checklist: [
    { id: 'c1', label: 'Revisar pipeline CRM y actualizar etapas', completado: false },
    { id: 'c2', label: 'Publicar hilo en LinkedIn sobre IA en finanzas', completado: false },
    { id: 'c3', label: 'Reunion CODEIS — agenda de julio 18:00', completado: false },
  ],
  wins: [
    { texto: 'Primer contrato BrainTech firmado con cliente del sector retail', categoria: 'revenue' },
    { texto: 'Hilo sobre el IESS llego a 12.000 impresiones en 24 horas', categoria: 'content' },
  ],
  priorities: [
    { proyecto: 'BrainTech', tarea: 'Propuesta expansion Rafik USA', urgencia: 'alta' },
    { proyecto: 'Marca personal', tarea: 'Hilo LinkedIn IA para finanzas', urgencia: 'alta' },
    { proyecto: 'CODEIS', tarea: 'Confirmar agenda reunion julio', urgencia: 'media' },
    { proyecto: 'taskr', tarea: 'Revisar wireframes MVP con equipo', urgencia: 'baja' },
  ],
};
