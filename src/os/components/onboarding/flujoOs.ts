import type { PasoConfig, Respuestas } from './OSOnboardingFlow';

// Flujo de onboarding del modulo OS: confirmar-y-ajustar, no llenar desde cero.
// Los datos reales de Pancho ya estan sembrados en Supabase (os_objetivos,
// os_lineas, os_semana, os_funcion_presupuesto); OSOnboarding.tsx prellena
// `respuestasIniciales` desde ahi. Este flujo solo confirma o ajusta.

const DIAS_CORTO = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // ISO 1..7

const NOMBRES_LINEAS = [
  'BrainTech', 'Rafik', 'taskr', 'Arazza', 'Marca personal', 'ELAB', 'Art for Peace', 'CODEIS',
];

/**
 * Deriva los tres modos de la semana a partir de los dias elegidos como maker/off.
 * Regla: si un dia esta en ambos, descansar le gana a trabajar (off gana). El resto
 * de los dias (los que no estan en ninguno de los dos) son manager por defecto.
 * Se exporta para que el servidor (api/os/onboarding.ts) use exactamente la misma regla.
 */
export function resumenModos(r: Respuestas): { maker: number[]; manager: number[]; off: number[] } {
  const maker: number[] = Array.isArray(r.dias_maker) ? r.dias_maker : [];
  const off: number[] = Array.isArray(r.dias_off) ? r.dias_off : [];
  const offSet = new Set(off);
  const makerFinal = maker.filter((d) => !offSet.has(d));
  const manager: number[] = [];
  for (let d = 1; d <= 7; d++) {
    if (offSet.has(d)) continue;
    if (makerFinal.includes(d)) continue;
    manager.push(d);
  }
  return { maker: makerFinal, manager, off };
}

function listaDias(dias: number[]): string {
  return dias.length ? dias.map((d) => DIAS_CORTO[d - 1]).join(' · ') : 'Ninguno';
}

export const PASOS_OS: PasoConfig[] = [
  {
    key: 'bienvenida',
    tipo: 'intro',
    titulo: 'Vamos a encender tu sistema',
    copy: 'Tus datos ya estan cargados desde tu brain: objetivos, lineas, semana y presupuesto de horas. Esto no es empezar de cero, es confirmar y ajustar lo que ya sabemos de ti.',
    ctaLabel: 'Empezar',
  },
  {
    key: 'identidad',
    tipo: 'texto',
    titulo: 'Tu identidad operativa',
    copy: 'Esto gobierna el objetivo, no al reves: no persigues un numero, sostienes una identidad cada dia y el numero es la consecuencia.',
    requerido: true,
    campos: [
      {
        key: 'texto',
        label: 'Soy...',
        multilinea: true,
        sugerido: () => 'Soy un builder que opera sistemas y los cobra. Las finanzas son la consecuencia de sostener esa identidad cada dia, no un numero que persigo.',
      },
    ],
  },
  {
    key: 'punto_partida',
    tipo: 'texto',
    titulo: 'El punto de partida honesto',
    copy: 'Sin datos reales aca, tus objetivos son deseos. Escribe el numero tal cual esta hoy, no el que quisieras.',
    requerido: true,
    campos: [
      { key: 'finanzas', label: 'Deuda y credito hoy', multilinea: true, placeholder: 'Ej: deuda tarjeta X, linea de credito Y disponible...' },
      { key: 'ingresos', label: 'Ingreso actual por linea', multilinea: true, placeholder: 'Ej: BrainTech $X/mes, Rafik $Y/mes...' },
    ],
  },
  {
    key: 'dias_maker',
    tipo: 'dias',
    titulo: 'Que dias son Maker?',
    copy: 'Bloques largos sin reuniones, minimo 3 dias. Los dias que no marques aca ni en descanso quedan como Manager automaticamente.',
  },
  {
    key: 'dias_off',
    tipo: 'dias',
    titulo: 'Que dias descansas?',
    copy: 'El descanso es parte del sistema, no su ausencia. Si un dia lo marcas aca y tambien como Maker, gana el descanso.',
  },
  {
    key: 'dias_sale',
    tipo: 'dias',
    titulo: 'Que dias sales de casa?',
    copy: 'Maximo 2, y esos dias no vuelves a cambiar de chip.',
  },
  {
    key: 'lineas_maker',
    tipo: 'multi',
    titulo: 'Que lineas reciben tiempo Maker?',
    copy: 'Cada lunes eliges 2 o 3; el resto queda en mantenimiento.',
    opciones: NOMBRES_LINEAS.map((nombre) => ({ value: nombre, label: nombre })),
  },
  {
    key: 'presupuesto',
    tipo: 'numero',
    titulo: 'Cuantas horas por semana a cada funcion?',
    copy: 'El 4/4/4 de Hormozi es un default para principiantes. Lo avanzado es sobre-asignar al cuello de botella, no repartir parejo.',
    campos: [
      { key: 'promover', label: 'Promover', sufijo: 'h', sugerido: () => 8 },
      { key: 'vender', label: 'Vender', sufijo: 'h', sugerido: () => 12 },
      { key: 'construir', label: 'Construir', sufijo: 'h', sugerido: () => 12 },
      { key: 'entregar', label: 'Entregar', sufijo: 'h', sugerido: () => 12 },
    ],
  },
  {
    key: 'armando',
    tipo: 'construyendo',
    titulo: 'Armando tu sistema',
    mensaje: 'Casi listo…',
    duracionMs: 2200,
  },
  {
    key: 'resumen',
    tipo: 'resumen',
    titulo: 'Tu sistema',
    copy: 'Revisa y confirma. Todo se puede editar despues desde cada modulo.',
    ctaLabel: 'Encender el sistema',
    items: [
      {
        label: 'Identidad',
        valor: (r) => r.identidad?.texto?.trim() || '-',
        editKey: 'identidad',
      },
      {
        label: 'Punto de partida (finanzas)',
        valor: (r) => r.punto_partida?.finanzas?.trim() || '-',
        editKey: 'punto_partida',
      },
      {
        label: 'Punto de partida (ingresos)',
        valor: (r) => r.punto_partida?.ingresos?.trim() || '-',
        editKey: 'punto_partida',
      },
      {
        label: 'Dias Maker',
        valor: (r) => listaDias(resumenModos(r).maker),
        editKey: 'dias_maker',
      },
      {
        label: 'Dias Manager',
        valor: (r) => listaDias(resumenModos(r).manager),
        editKey: 'dias_maker',
      },
      {
        label: 'Dias Off',
        valor: (r) => listaDias(resumenModos(r).off),
        editKey: 'dias_off',
      },
      {
        label: 'Dias que sales',
        valor: (r) => listaDias(Array.isArray(r.dias_sale) ? r.dias_sale : []),
        editKey: 'dias_sale',
      },
      {
        label: 'Lineas Maker',
        valor: (r) => {
          const l: string[] = Array.isArray(r.lineas_maker) ? r.lineas_maker : [];
          return l.length ? l.join(' · ') : 'Ninguna';
        },
        editKey: 'lineas_maker',
      },
      {
        label: 'Presupuesto de horas',
        valor: (r) => {
          const p = r.presupuesto ?? {};
          return `Promover ${p.promover ?? '-'}h · Vender ${p.vender ?? '-'}h · Construir ${p.construir ?? '-'}h · Entregar ${p.entregar ?? '-'}h`;
        },
        editKey: 'presupuesto',
      },
    ],
  },
];
