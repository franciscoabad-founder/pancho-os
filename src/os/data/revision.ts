import type { DatosRevision } from './types';

export const datosRevision: DatosRevision = {
  weekly: {
    periodo: 'Semana 25 — 16 al 22 jun 2026',
    completado: [
      'Cerrar contrato cliente retail para BrainTech',
      'Publicar post sobre Kit IA para finanzas',
      'Revision de roadmap taskr con equipo de producto',
      'Reunion con mentores CODEIS — planificacion julio',
    ],
    que_parar: [
      'Responder WhatsApp en tiempo real durante bloques de deep work',
      'Aceptar reuniones sin agenda previa',
    ],
    que_escalar: [
      'Propuesta Rafik USA: requiere input legal antes del viernes',
      'Servidor gbrain: revisar capacidad si escala',
    ],
    energia: 'alta',
    nota: 'Semana de mucho output. El sistema funciono. Mantener bloques Maker intactos la proxima semana.',
  },
  monthly: {
    periodo: 'Junio 2026',
    wins: [
      '2 nuevos contratos BrainTech firmados',
      'Kit IA para finanzas lanzado con 340 descargas el primer dia',
      'Newsletter "Desde Adentro" supero 1.200 suscriptores',
      'taskr: primer demo externo completado con feedback positivo',
    ],
    pendientes: [
      'Definir estructura legal ELAB para Q3',
      'Documentar proceso de onboarding BrainTech',
      'Activar Beehiiv en formulario del Kit',
    ],
    decision_clave:
      'Enfocar capacidad de BrainTech en legaltech y fintech hasta agosto. Suspender nuevas verticales.',
    numero_destacado: '$18.400',
    numero_label: 'ingresos totales junio',
  },
};
