export interface DominoDia {
  tarea: string;
  proyecto: string;
  razon: string;
}

export interface DiscomfortItem {
  tarea: string;
  contexto: string;
}

export interface CheckItem {
  id: string;
  label: string;
  completado: boolean;
}

export interface Win {
  texto: string;
  categoria: 'revenue' | 'content' | 'network' | 'personal';
}

export interface PriorityItem {
  proyecto: string;
  tarea: string;
  urgencia: 'alta' | 'media' | 'baja';
}

export interface DatosHoy {
  fecha: string;
  domino: DominoDia;
  discomfort: DiscomfortItem;
  checklist: CheckItem[];
  wins: Win[];
  priorities: PriorityItem[];
}

export interface RutinaItem {
  id: string;
  label: string;
  duracion?: string;
  completado: boolean;
}

export type TipoDia = 'maker' | 'manager' | 'off';

export interface DiaSemana {
  dia: string;
  tipo: TipoDia;
  descripcion: string;
  detalle: string;
}

export interface DatosDaily {
  principios: string[];
  semana: DiaSemana[];
  rutina_am: RutinaItem[];
  check_10min: string[];
  pm_close: RutinaItem[];
  reglas: string[];
}

export interface ReviewWeekly {
  periodo: string;
  completado: string[];
  que_parar: string[];
  que_escalar: string[];
  energia: 'alta' | 'media' | 'baja';
  nota: string;
}

export interface ReviewMonthly {
  periodo: string;
  wins: string[];
  pendientes: string[];
  decision_clave: string;
  numero_destacado: string;
  numero_label: string;
}

export interface DatosRevision {
  weekly: ReviewWeekly;
  monthly: ReviewMonthly;
}

export type KPITrend = 'up' | 'down' | 'flat';

export interface KPICard {
  id: string;
  label: string;
  valor: string;
  cambio: string;
  tendencia: KPITrend;
  periodo: string;
  categoria: string;
}

export type ProyectoStatus = 'activo' | 'pausado' | 'por-lanzar' | 'en-curso';
export type ProyectoTipo = 'consultora' | 'startup' | 'ong' | 'for-profit' | 'cliente' | 'negocio' | 'marca';

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: ProyectoTipo;
  status: ProyectoStatus;
  siguiente_accion: string;
  deadline?: string;
  motor: boolean;
  recibe_maker: boolean;
}

export interface ObjetivoTrimestral {
  id: string;
  titulo: string;
  descripcion: string;
}

export interface SistemaObjetivo extends ObjetivoTrimestral {
  metrica?: string;
}

export interface SistemaPriorityItem extends PriorityItem {
  id: string;
  orden: number;
  owner?: string;
}

export interface SistemaModulo {
  id: string;
  nombre: string;
  estado: 'activo' | 'pendiente' | 'pausado';
  descripcion: string;
}

export interface SistemaConexion {
  id: string;
  nombre: string;
  estado: 'activo' | 'pendiente' | 'error';
  detalle: string;
}

export interface SistemaOnboarding {
  completado: boolean;
  nombre: string;
  foco_90_dias: string;
  tono_agente: string;
  ritmo: string;
  canales: string[];
}

export interface FinanzasOnboarding {
  moneda_base: string;
  ingreso_mensual_necesario: string;
  runway_objetivo_meses: string;
  deuda_prioritaria: string;
  regla_asignacion: string;
  cuentas_a_conectar: string[];
  cadencia_revision: string;
}

export interface SistemaState {
  version: number;
  updated_at: string;
  onboarding: SistemaOnboarding;
  finanzas_onboarding: FinanzasOnboarding;
  objetivos_90d: SistemaObjetivo[];
  priority_stack: SistemaPriorityItem[];
  modulos: SistemaModulo[];
  conexiones: SistemaConexion[];
}

export interface ApprovalItem {
  id: string;
  titulo: string;
  descripcion: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'ejecutado';
  tipo: 'sistema' | 'infra' | 'contenido' | 'finanzas' | 'otro';
  creado_en: string;
}

export type CRMEtapa = 'prospecto' | 'contacto' | 'propuesta' | 'negociacion' | 'cerrado';

export interface CRMLead {
  id: string;
  empresa: string;
  contacto: string;
  etapa: CRMEtapa;
  valor?: string;
  siguiente_accion: string;
  ultimo_contacto: string;
  proyecto_origen: string;
}

export type TareaPrioridad = 'alta' | 'media' | 'baja';
export type TareaStatus = 'pendiente' | 'en-curso' | 'completada';

export interface Tarea {
  id: string;
  label: string;
  proyecto: string;
  prioridad: TareaPrioridad;
  status: TareaStatus;
  deadline?: string;
}

export interface EventoAgenda {
  id: string;
  titulo: string;
  hora: string;
  duracion: string;
  tipo: 'reunion' | 'recordatorio' | 'deep-work' | 'personal';
  con?: string;
  fecha: string;
}

export interface ItemBandeja {
  id: string;
  titulo: string;
  url?: string;
  descripcion: string;
  deadline?: string;
  categoria: 'articulo' | 'tarea' | 'decision' | 'recurso' | 'link';
  leido: boolean;
  fecha_captura: string;
}

export interface IdeaContenido {
  id: string;
  titulo: string;
  formato: 'hilo' | 'post' | 'articulo' | 'video' | 'newsletter';
  idea_madre: string;
  repurposing: string[];
  status: 'idea' | 'en-produccion' | 'publicado' | 'archivado';
  plataformas: string[];
  fecha_target?: string;
}

export interface TransaccionFinanzas {
  id: string;
  descripcion: string;
  monto: number;
  tipo: 'ingreso' | 'gasto';
  categoria: string;
  proyecto?: string;
  fecha: string;
}

export interface MetaFinanciera {
  label: string;
  actual: number;
  meta: number;
  unidad: string;
}

export interface DatosFinanzas {
  mes: string;
  ingresos_total: number;
  gastos_total: number;
  balance: number;
  transacciones: TransaccionFinanzas[];
  metas: MetaFinanciera[];
}

export interface HabitoSalud {
  id: string;
  label: string;
  completado: boolean;
  racha: number;
}

export interface DatosSalud {
  fecha: string;
  identidad: string;
  filosofia: string;
  reglas: string[];
  pasos: number;
  pasos_meta: number;
  sueno_horas: number;
  sueno_meta: number;
  peso_kg: number;
  agua_litros: number;
  agua_meta: number;
  habitos: HabitoSalud[];
}

export interface NotaCerebro {
  id: string;
  titulo: string;
  resumen: string;
  tags: string[];
  fecha: string;
  conexiones: string[];
}

export interface GrafoNodo {
  id: string;
  label: string;
  tipo: 'proyecto' | 'concepto' | 'persona' | 'herramienta';
  peso: number;
}

export interface GrafoArista {
  origen: string;
  destino: string;
  etiqueta?: string;
}

export interface RedSocial {
  red: 'linkedin' | 'instagram' | 'youtube';
  seguidores: number;
  alcance_semana: number;
  publicaciones_semana: number;
  tendencia: 'up' | 'down' | 'flat';
  ultimo_post?: string;
}

export interface Borrador {
  id: string;
  titulo: string;
  cuerpo: string;
  plataforma: 'linkedin' | 'instagram' | 'twitter' | 'blog';
  fecha: string;
}
