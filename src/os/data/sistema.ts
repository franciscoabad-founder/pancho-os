import type { ApprovalItem, SistemaState } from './types';
import { objetivos } from './objetivos';
import { datosHoy } from './hoy';

export const sistemaDefault: SistemaState = {
  version: 1,
  updated_at: '2026-07-09T00:00:00.000Z',
  onboarding: {
    completado: false,
    nombre: 'Pancho',
    foco_90_dias: 'Estabilizar finanzas, ordenar lo legal y convertir proyectos activos en motores que generen sin depender solo de ejecucion manual.',
    tono_agente: 'Directo, ejecutivo, calido y con memoria. Debe empujar decisiones incomodas con tacto.',
    ritmo: 'Briefing AM, captura durante el dia, cierre PM y revision semanal.',
    canales: ['Telegram', 'OS web', 'n8n', 'Hermes', 'gbrain'],
  },
  finanzas_onboarding: {
    moneda_base: 'USD',
    ingreso_mensual_necesario: '',
    runway_objetivo_meses: '3',
    deuda_prioritaria: '',
    regla_asignacion: 'Primero cubrir fijos, luego deuda de mayor tasa, luego colchon y reinversion.',
    cuentas_a_conectar: ['Cuentas bancarias', 'Tarjetas', 'Por cobrar', 'Deudas', 'Gastos recurrentes'],
    cadencia_revision: 'Viernes: revision financiera semanal. Inicio de mes: cierre y presupuesto.',
  },
  objetivos_90d: objetivos.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    descripcion: o.descripcion,
    metrica: '',
  })),
  priority_stack: datosHoy.priorities.map((p, index) => ({
    id: `p${index + 1}`,
    orden: index + 1,
    proyecto: p.proyecto,
    tarea: p.tarea,
    urgencia: p.urgencia,
    owner: 'Pancho',
  })),
  modulos: [
    { id: 'cerebro', nombre: 'Cerebro', estado: 'activo', descripcion: 'gbrain en VPS con notas, grafo, busqueda y chat desde el OS.' },
    { id: 'telegram', nombre: 'Telegram', estado: 'activo', descripcion: 'Canal principal para captura, briefing y ejecucion via n8n.' },
    { id: 'n8n', nombre: 'n8n', estado: 'activo', descripcion: 'Orquestador del sistema, webhooks, agenda, tareas y asistente.' },
    { id: 'hermes', nombre: 'Hermes', estado: 'activo', descripcion: 'Ejecutor headless en el VPS conectado al brain y al sistema.' },
    { id: 'supabase', nombre: 'Supabase OS', estado: 'activo', descripcion: 'Fuente operacional para tareas, CRM, agenda, finanzas y estado editable.' },
    { id: 'skills', nombre: 'Skills documentales', estado: 'pendiente', descripcion: 'Docx, PDF, PPTX, XLSX y skill creator como capacidades del agente.' },
  ],
  conexiones: [
    { id: 'vps', nombre: 'VPS pancho-automations-01', estado: 'activo', detalle: '178.105.163.120 con n8n, Caddy, gbrain, Postgres y Hermes.' },
    { id: 'brain', nombre: 'gbrain', estado: 'activo', detalle: 'https://brain.franciscoabad.com/mcp' },
    { id: 'n8n', nombre: 'n8n', estado: 'activo', detalle: 'https://n8n.franciscoabad.com' },
    { id: 'openrouter', nombre: 'BYOK y saldo modelos', estado: 'pendiente', detalle: 'Agregar lectura de saldo si el proveedor expone API segura para servidor.' },
  ],
};

export const aprobacionesDefault: ApprovalItem[] = [
  {
    id: 'ap-doc-skills',
    titulo: 'Instalar skills documentales en Hermes',
    descripcion: 'Docx, PDF, PPTX, XLSX y skill creator para que el agente produzca documentos, hojas y presentaciones.',
    estado: 'pendiente',
    tipo: 'infra',
    creado_en: '2026-07-09T00:00:00.000Z',
  },
  {
    id: 'ap-os-data',
    titulo: 'Conectar n8n y Hermes al estado de Mi Sistema',
    descripcion: 'Usar /api/os/system para leer objetivos, prioridad, modulos y ritmo antes de ejecutar decisiones.',
    estado: 'pendiente',
    tipo: 'sistema',
    creado_en: '2026-07-09T00:00:00.000Z',
  },
];
