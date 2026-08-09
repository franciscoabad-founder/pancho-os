import type { PasoConfig, Respuestas } from './OSOnboardingFlow';

// Flujo de onboarding del modulo Salud (Yazio-style): meta -> peso -> targets ->
// ayuno -> dias de entreno -> unidad -> "construyendo" -> resumen -> aplicar.

const LB_A_KG = 0.453592;

/** Peso actual en kg, convertido desde el paso 'peso_actual' (soporta kg/lb). */
export function pesoActualKg(respuestas: Respuestas): number | undefined {
  const peso = respuestas.peso_actual;
  if (!peso || peso.valor == null || !Number.isFinite(peso.valor)) return undefined;
  return peso.unidad === 'lb' ? Math.round(peso.valor * LB_A_KG * 10) / 10 : peso.valor;
}

function sugeridoProteina(r: Respuestas): number | undefined {
  const kg = pesoActualKg(r);
  return kg != null ? Math.round(kg * 1.8) : undefined;
}

function sugeridoGrasa(r: Respuestas): number | undefined {
  const kg = pesoActualKg(r);
  return kg != null ? Math.round(kg * 0.8) : undefined;
}

function sugeridoKcal(r: Respuestas): number | undefined {
  const kg = pesoActualKg(r);
  if (kg == null) return undefined;
  const factor = r.meta === 'bajar_grasa' ? 26 : 30;
  return Math.round(kg * factor);
}

function sugeridoCarbos(r: Respuestas): number | undefined {
  const actuales = r.targets ?? {};
  const kcal = actuales.kcal ?? sugeridoKcal(r);
  const proteina = actuales.proteina_g ?? sugeridoProteina(r);
  const grasa = actuales.grasa_g ?? sugeridoGrasa(r);
  if (kcal == null || proteina == null || grasa == null) return undefined;
  const restante = kcal - proteina * 4 - grasa * 9;
  return Math.max(0, Math.round(restante / 4));
}

const LABEL_META: Record<string, string> = {
  bajar_grasa: 'Bajar grasa',
  ganar_musculo: 'Ganar musculo',
  rendimiento: 'Rendimiento',
  construir_habitos: 'Construir habitos',
};

const LABEL_AYUNO: Record<string, string> = {
  '16:8': '16:8 (ventana de 8 horas)',
  '24h': '24 horas',
  '36h': '36 horas (extendido)',
  sin_ayuno: 'Sin ayuno',
};

const DIAS_CORTO = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const PASOS_SALUD: PasoConfig[] = [
  {
    key: 'intro',
    tipo: 'intro',
    titulo: 'Vamos a armar tu plan de salud',
    copy: 'Ocho preguntas rapidas y te dejamos listos los objetivos de nutricion, ayuno y entrenamiento. Puedes ajustar todo despues.',
    ctaLabel: 'Empezar',
  },
  {
    key: 'meta',
    tipo: 'opciones',
    titulo: 'Cual es tu meta principal?',
    opciones: [
      { value: 'bajar_grasa', label: 'Bajar grasa', icono: 'trending_down' },
      { value: 'ganar_musculo', label: 'Ganar musculo', icono: 'fitness_center' },
      { value: 'rendimiento', label: 'Rendimiento', icono: 'bolt' },
      { value: 'construir_habitos', label: 'Construir habitos', icono: 'auto_awesome' },
    ],
  },
  {
    key: 'peso_actual',
    tipo: 'numero',
    titulo: 'Cual es tu peso actual?',
    campos: [{ key: 'valor', label: 'Peso actual' }],
    unidades: ['kg', 'lb'],
    unidadDefault: 'kg',
  },
  {
    key: 'peso_objetivo',
    tipo: 'numero',
    titulo: 'Cual es tu peso objetivo?',
    campos: [{ key: 'valor', label: 'Peso objetivo' }],
    unidades: ['kg', 'lb'],
    unidadDefault: 'kg',
  },
  {
    key: 'targets',
    tipo: 'numero',
    titulo: 'Tus targets diarios',
    copy: 'Los calculamos por ti a partir de tu peso. Puedes ajustarlos si prefieres otros numeros.',
    campos: [
      { key: 'kcal', label: 'Calorias', sufijo: 'kcal', sugerido: sugeridoKcal },
      { key: 'proteina_g', label: 'Proteina', sufijo: 'g', sugerido: sugeridoProteina },
      { key: 'grasa_g', label: 'Grasa', sufijo: 'g', sugerido: sugeridoGrasa },
      { key: 'carbos_g', label: 'Carbohidratos', sufijo: 'g', sugerido: sugeridoCarbos },
    ],
  },
  {
    key: 'protocolo_ayuno',
    tipo: 'opciones',
    titulo: 'Practicas algun protocolo de ayuno?',
    opciones: [
      { value: '16:8', label: '16:8', descripcion: 'Ventana de alimentacion de 8 horas' },
      { value: '24h', label: '24 horas', descripcion: 'Un dia completo, una vez a la semana' },
      { value: '36h', label: '36 horas', descripcion: 'Ayuno extendido' },
      { value: 'sin_ayuno', label: 'Sin ayuno', descripcion: 'Prefiero no ayunar por ahora' },
    ],
  },
  {
    key: 'dias_entreno',
    tipo: 'dias',
    titulo: 'Que dias entrenas?',
    copy: 'Elige los dias en los que planeas entrenar (puedes cambiarlo cuando quieras).',
  },
  {
    key: 'unidad',
    tipo: 'opciones',
    titulo: 'En que unidad prefieres ver tu peso?',
    opciones: [
      { value: 'kg', label: 'Kilogramos (kg)' },
      { value: 'lb', label: 'Libras (lb)' },
    ],
  },
  {
    key: 'construyendo',
    tipo: 'construyendo',
    titulo: 'Construyendo tu plan',
    mensaje: 'Casi listo…',
    duracionMs: 2500,
  },
  {
    key: 'resumen',
    tipo: 'resumen',
    titulo: 'Tu plan de salud',
    copy: 'Revisa y aplica. Todo se puede editar despues desde cada modulo.',
    ctaLabel: 'Aplicar mi plan',
    items: [
      { label: 'Meta', valor: (r) => LABEL_META[r.meta] ?? '-', editKey: 'meta' },
      {
        label: 'Peso actual',
        valor: (r) => (r.peso_actual?.valor != null ? `${r.peso_actual.valor} ${r.peso_actual.unidad ?? 'kg'}` : '-'),
        editKey: 'peso_actual',
      },
      {
        label: 'Peso objetivo',
        valor: (r) => (r.peso_objetivo?.valor != null ? `${r.peso_objetivo.valor} ${r.peso_objetivo.unidad ?? 'kg'}` : '-'),
        editKey: 'peso_objetivo',
      },
      {
        label: 'Targets diarios',
        valor: (r) => {
          const t = r.targets ?? {};
          return `${t.kcal ?? '-'} kcal · ${t.proteina_g ?? '-'} g prot · ${t.carbos_g ?? '-'} g carb · ${t.grasa_g ?? '-'} g grasa`;
        },
        editKey: 'targets',
      },
      { label: 'Ayuno', valor: (r) => LABEL_AYUNO[r.protocolo_ayuno] ?? '-', editKey: 'protocolo_ayuno' },
      {
        label: 'Dias de entreno',
        valor: (r) => {
          const dias: number[] = r.dias_entreno ?? [];
          return dias.length ? dias.map((d) => DIAS_CORTO[d - 1]).join(' · ') : 'Ninguno por ahora';
        },
        editKey: 'dias_entreno',
      },
      { label: 'Unidad de peso', valor: (r) => (r.unidad === 'lb' ? 'Libras (lb)' : 'Kilogramos (kg)'), editKey: 'unidad' },
    ],
  },
];
