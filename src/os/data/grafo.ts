import type { GrafoNodo, GrafoArista } from './types';

// TODO: replace with real gbrain data via /mcp endpoint when available
export const grafoNodos: GrafoNodo[] = [
  { id: 'braintech', label: 'BrainTech', tipo: 'proyecto', peso: 3 },
  { id: 'taskr', label: 'taskr', tipo: 'proyecto', peso: 2 },
  { id: 'rafik', label: 'Rafik', tipo: 'proyecto', peso: 2 },
  { id: 'arazza', label: 'Arazza', tipo: 'proyecto', peso: 2 },
  { id: 'elab', label: 'ELAB', tipo: 'proyecto', peso: 2 },
  { id: 'marca', label: 'Marca personal', tipo: 'proyecto', peso: 2 },
  { id: 'codeis', label: 'CODEIS', tipo: 'proyecto', peso: 1 },
  { id: 'ai-native', label: 'AI-native', tipo: 'concepto', peso: 2 },
  { id: 'sistemas', label: 'Sistemas', tipo: 'concepto', peso: 2 },
  { id: 'finanzas', label: 'Finanzas', tipo: 'concepto', peso: 1 },
  { id: 'liderazgo', label: 'Liderazgo', tipo: 'concepto', peso: 1 },
  { id: 'maker-mgr', label: 'Maker/Manager', tipo: 'concepto', peso: 1 },
];

export const grafoAristas: GrafoArista[] = [
  { origen: 'braintech', destino: 'ai-native', etiqueta: 'nucleo' },
  { origen: 'braintech', destino: 'sistemas' },
  { origen: 'taskr', destino: 'braintech' },
  { origen: 'rafik', destino: 'braintech' },
  { origen: 'arazza', destino: 'braintech' },
  { origen: 'elab', destino: 'sistemas' },
  { origen: 'marca', destino: 'liderazgo' },
  { origen: 'marca', destino: 'sistemas' },
  { origen: 'codeis', destino: 'liderazgo' },
  { origen: 'ai-native', destino: 'sistemas' },
  { origen: 'braintech', destino: 'finanzas', etiqueta: 'motor' },
  { origen: 'maker-mgr', destino: 'braintech' },
  { origen: 'maker-mgr', destino: 'taskr' },
];
