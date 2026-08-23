import type { PasoConfig, Respuestas } from './OSOnboardingFlow';

// Flujo de onboarding del modulo Juego: mecanicas -> que mecanicas quedan
// encendidas -> primeras recompensas -> primera quest -> resumen -> aplicar.
//
// Principio: todo modulo que necesita una linea base tiene su propio onboarding.
// La linea base del Juego no es un numero (como el peso en Salud) sino el
// contrato: que mecanicas juega y con que las cambia (recompensas y quest).

export const MECANICAS = [
  { value: 'hp', label: 'Vida (HP)', icono: 'favorite', descripcion: 'Pierdes vida cuando fallas una diaria' },
  { value: 'oro', label: 'Oro y tienda', icono: 'paid', descripcion: 'Ganas oro y lo cambias por recompensas' },
  { value: 'loot', label: 'Loot y sorpresas', icono: 'featured_seasonal_and_gifts', descripcion: 'Premios aleatorios al cumplir' },
];

export const EVENTOS_QUEST = [
  { value: 'sesion_gym', label: 'Sesiones de gym' },
  { value: 'tarea_hecha', label: 'Tareas hechas' },
  { value: 'comida_log', label: 'Comidas registradas' },
  { value: 'ayuno_fin', label: 'Ayunos completados' },
];

const LABEL_EVENTO: Record<string, string> = Object.fromEntries(
  EVENTOS_QUEST.map((e) => [e.value, e.label]),
);

/** Recompensas con nombre no vacio, ya emparejadas con su costo en oro. */
export function recompensasDelOnboarding(
  r: Respuestas,
): Array<{ nombre: string; costo_oro: number }> {
  const nombres = (r?.recompensas ?? {}) as Record<string, unknown>;
  const costos = (r?.costos ?? {}) as Record<string, unknown>;
  const salida: Array<{ nombre: string; costo_oro: number }> = [];
  for (const slot of ['r1', 'r2', 'r3']) {
    const nombre = String(nombres[slot] ?? '').trim();
    if (!nombre) continue;
    const costo = Number(costos[slot.replace('r', 'c')]);
    salida.push({ nombre, costo_oro: Number.isFinite(costo) && costo > 0 ? Math.round(costo) : 50 });
  }
  return salida;
}

/** Mecanicas encendidas segun el paso 'mecanicas_on'. Sin respuesta: todo encendido. */
export function mecanicasDelOnboarding(r: Respuestas): { hp_activo: boolean; oro_activo: boolean; loot_activo: boolean } {
  const sel = Array.isArray(r?.mecanicas_on) ? (r.mecanicas_on as string[]) : null;
  if (!sel) return { hp_activo: true, oro_activo: true, loot_activo: true };
  return {
    hp_activo: sel.includes('hp'),
    oro_activo: sel.includes('oro'),
    loot_activo: sel.includes('loot'),
  };
}

/** Quest inicial, o null si no puso titulo. */
export function questDelOnboarding(r: Respuestas): {
  titulo: string;
  evento: string;
  meta: number;
  apuesta_oro: number;
  premio_xp: number;
} | null {
  const titulo = String((r?.quest as Record<string, unknown>)?.titulo ?? '').trim();
  if (!titulo) return null;
  const numeros = (r?.quest_numeros ?? {}) as Record<string, unknown>;
  const num = (clave: string, porDefecto: number) => {
    const v = Number(numeros[clave]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : porDefecto;
  };
  const evento = typeof r?.quest_evento === 'string' ? (r.quest_evento as string) : 'tarea_hecha';
  return {
    titulo,
    evento,
    meta: Math.max(1, num('meta', 3)),
    apuesta_oro: num('apuesta', 0),
    premio_xp: num('premio_xp', 30),
  };
}

export const RESPUESTAS_INICIALES_JUEGO: Respuestas = {
  mecanicas_on: ['hp', 'oro', 'loot'],
  quest_evento: 'tarea_hecha',
};

export const PASOS_JUEGO: PasoConfig[] = [
  {
    key: 'intro',
    tipo: 'intro',
    titulo: 'Asi funciona tu juego',
    copy:
      'Cumplir habitos te da XP y subes de nivel. Fallar una diaria te quita vida. '
      + 'El oro que ganas lo cambias por recompensas que tu mismo defines. '
      + 'Nada de esto es obligatorio: en el siguiente paso decides que mecanicas juegas.',
    ctaLabel: 'Empezar',
  },
  {
    key: 'mecanicas_on',
    tipo: 'multi',
    titulo: 'Que mecanicas quieres encendidas',
    copy: 'Puedes cambiarlas cuando quieras desde Config, dentro del modulo.',
    opciones: MECANICAS,
  },
  {
    key: 'recompensas',
    tipo: 'texto',
    titulo: 'Tus primeras recompensas',
    copy: 'Cosas que de verdad comprarias con oro. Con una basta para arrancar.',
    campos: [
      { key: 'r1', label: 'Recompensa 1', placeholder: 'Ej. Noche de serie sin culpa' },
      { key: 'r2', label: 'Recompensa 2 (opcional)', placeholder: 'Ej. Almuerzo fuera' },
      { key: 'r3', label: 'Recompensa 3 (opcional)', placeholder: 'Ej. Compra que vengo postergando' },
    ],
  },
  {
    key: 'costos',
    tipo: 'numero',
    titulo: 'Cuanto oro cuesta cada una',
    copy: 'Un habito cumplido da entre 5 y 15 de oro. Calibra pensando en dias, no en minutos.',
    campos: [
      { key: 'c1', label: 'Recompensa 1', sufijo: 'oro', sugerido: () => 50 },
      { key: 'c2', label: 'Recompensa 2', sufijo: 'oro', sugerido: () => 100 },
      { key: 'c3', label: 'Recompensa 3', sufijo: 'oro', sugerido: () => 200 },
    ],
  },
  {
    key: 'quest',
    tipo: 'texto',
    titulo: 'Tu quest de esta semana',
    copy: 'Un compromiso concreto para los proximos siete dias. Puedes saltarlo y crearlo despues.',
    campos: [
      { key: 'titulo', label: 'Titulo de la quest (opcional)', placeholder: 'Ej. 4 sesiones de gym esta semana' },
    ],
  },
  {
    key: 'quest_evento',
    tipo: 'opciones',
    titulo: 'Que se cuenta para esa quest',
    copy: 'El progreso se calcula solo con lo que ya registras en el OS.',
    requerido: false,
    opciones: EVENTOS_QUEST,
  },
  {
    key: 'quest_numeros',
    tipo: 'numero',
    titulo: 'Meta, apuesta y premio',
    copy: 'La apuesta es pre compromiso: si no cumples, pierdes ese oro.',
    campos: [
      { key: 'meta', label: 'Meta', sufijo: 'veces', sugerido: () => 3 },
      { key: 'apuesta', label: 'Apuesta', sufijo: 'oro', sugerido: () => 0 },
      { key: 'premio_xp', label: 'Premio', sufijo: 'XP', sugerido: () => 30 },
    ],
  },
  {
    key: 'resumen',
    tipo: 'resumen',
    titulo: 'Tu linea base del juego',
    copy: 'Se aplica sobre un jugador en nivel 1. Todo se edita despues desde el modulo.',
    ctaLabel: 'Aplicar y empezar',
    items: [
      {
        label: 'Mecanicas encendidas',
        valor: (r) => {
          const m = mecanicasDelOnboarding(r);
          const on = [m.hp_activo && 'Vida', m.oro_activo && 'Oro', m.loot_activo && 'Loot'].filter(Boolean);
          return on.length ? on.join(' · ') : 'Ninguna: solo XP y nivel';
        },
        editKey: 'mecanicas_on',
      },
      {
        label: 'Recompensas',
        valor: (r) => {
          const lista = recompensasDelOnboarding(r);
          return lista.length ? lista.map((x) => `${x.nombre} (${x.costo_oro} oro)`).join(' · ') : 'Ninguna por ahora';
        },
        editKey: 'recompensas',
      },
      {
        label: 'Quest de la semana',
        valor: (r) => {
          const q = questDelOnboarding(r);
          if (!q) return 'Sin quest por ahora';
          const evento = LABEL_EVENTO[q.evento] ?? q.evento;
          return `${q.titulo} · ${evento} x${q.meta} · apuesta ${q.apuesta_oro} oro`;
        },
        editKey: 'quest',
      },
    ],
  },
];
