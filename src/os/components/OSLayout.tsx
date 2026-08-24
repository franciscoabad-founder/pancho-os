// Shell del OS en React, portado de src/layouts/OSLayout.astro.
//
// Reparto de responsabilidades respecto del .astro original:
//   - Lo que era <head> (fuentes, PWA, meta, script anti-FOUC del tema) vive
//     ahora en src/routes/__root.tsx, que es el unico documento HTML de la app.
//   - Lo que era <body> (command bar, sidebar, drawer movil, bottom nav, panel
//     de chat, captura rapida) es este componente, y cada pagina lo envuelve
//     alrededor de su contenido.
//
// Diferencias deliberadas con el original, todas comentadas donde ocurren:
//   1. Sin import de src/os/data/hoy.ts: esa fecha esta clavada en 2026-06-22 y
//      el dominoTexto que sacaba de ahi era ficticio. Se usa un placeholder
//      honesto hasta que el domino salga de datos reales.
//   2. El <script> imperativo del .astro (getElementById + addEventListener) se
//      reemplaza por estado de React, porque en un arbol React esos nodos son
//      del framework y manipularlos a mano genera peleas con el reconciliador.
//   3. El toggle de tema se resuelve por CSS sobre [data-theme] en vez de tocar
//      style.display: asi el icono correcto ya sale pintado del servidor y no
//      hay parpadeo ni desajuste de hidratacion.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { datosDaily } from '../data/daily.ts';
import OSJugadorBar from './OSJugadorBar.tsx';
import TaskiBubble from './TaskiBubble.tsx';

// Formato de titulo del OS, unico para todas las paginas. Se usa `·` como
// separador, igual que src/routes/login.tsx.
export function tituloOs(seccion: string): string {
  return `${seccion} · OS · Francisco Abad`;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const tipoLabel: Record<string, string> = { maker: 'Maker Mode', manager: 'Manager Mode', off: 'Modo Off' };
const tipoColor: Record<string, string> = { maker: '#6B7AE8', manager: '#6B7280', off: '#6B7280' };

// Placeholder honesto. El original leia datosHoy.domino.tarea de un archivo de
// datos estatico con fecha 2026-06-22 clavada, o sea que mostraba un domino
// inventado como si fuera el de hoy. Preferimos decir que no hay dato antes que
// mentir. Cuando el domino salga de Supabase, esto pasa a ser un prop o un
// loader del root.
const DOMINO_TEXTO = 'Sin domino definido';

// route -> Material Symbol
const ms: Record<string, string> = {
  '/': 'dashboard',
  '/sistema': 'account_tree',
  '/aprobaciones': 'approval_delegation',
  '/daily': 'wb_sunny',
  '/revision': 'history',
  '/semana': 'calendar_view_week',
  '/kpis': 'bar_chart',
  '/proyectos': 'folder',
  '/crm': 'contacts',
  '/tareas': 'checklist',
  '/agenda': 'calendar_today',
  '/grabar': 'mic',
  '/bandeja': 'inbox',
  '/contenido': 'edit_note',
  '/os/contenido': 'radar',
  '/redes': 'share',
  '/finanzas': 'payments',
  '/salud': 'favorite',
  '/gfit': 'fitness_center',
  '/habitos': 'task_alt',
  '/juego': 'sports_esports',
  '/comidas': 'restaurant',
  '/cerebro': 'psychology',
  '/pendientes': 'pending_actions',
  '/notas': 'edit_note',
  '/recordatorios': 'notifications',
  '/diario': 'auto_stories',
};

const navGroups = [
  { label: 'Sistema', items: [
    { href: '/', label: 'Hoy' },
    { href: '/sistema', label: 'Mi Sistema' },
    { href: '/aprobaciones', label: 'Aprobaciones' },
    { href: '/daily', label: 'Daily OS' },
    { href: '/revision', label: 'Revision' },
    { href: '/diario', label: 'Diario' },
  ]},
  { label: 'Control', items: [
    { href: '/semana', label: 'Semana' },
    { href: '/kpis', label: 'KPIs' },
    { href: '/proyectos', label: 'Proyectos' },
    { href: '/crm', label: 'CRM' },
    { href: '/tareas', label: 'Tareas' },
    { href: '/pendientes', label: 'Pendientes' },
    { href: '/recordatorios', label: 'Recordatorios' },
    { href: '/agenda', label: 'Agenda' },
    { href: '/grabar', label: 'Grabar' },
  ]},
  { label: 'Captura', items: [
    { href: '/bandeja', label: 'Por revisar' },
    { href: '/notas', label: 'Notas' },
    { href: '/contenido', label: 'Contenido' },
    { href: '/redes', label: 'Redes' },
    { href: '/finanzas', label: 'Finanzas' },
    { href: '/salud', label: 'Salud' },
    { href: '/gfit', label: 'GFIT' },
    { href: '/habitos', label: 'Hábitos' },
    { href: '/juego', label: 'Juego' },
  ]},
  { label: 'Conocimiento', items: [
    { href: '/cerebro', label: 'Cerebro' },
  ]},
];

// DECISION DE NAVEGACION (fase 1 del rediseno): una sola jerarquia.
// navGroups es LA fuente de verdad de toda la navegacion del OS.
// - Desktop: sidebar con los 4 grupos completos.
// - Movil: bottom-nav con 5 destinos primarios (Hoy, Sistema, Tareas,
//   Agenda, Salud) DERIVADOS de navGroups, + boton "Mas" que abre el
//   drawer con los mismos navGroups. Nada se define dos veces.
const primariosMovil = ['/', '/sistema', '/tareas', '/agenda', '/salud'];
const etiquetaCorta: Record<string, string> = { '/sistema': 'Sistema' };
const todosLosItems = navGroups.flatMap((g) => g.items);
const bottomNav = primariosMovil.map((href) => {
  const item = todosLosItems.find((i) => i.href === href);
  return {
    href,
    label: etiquetaCorta[href] ?? item?.label ?? href,
    icon: ms[href] ?? 'circle',
  };
});

// CSS del shell, copiado tal cual del <style> de OSLayout.astro. Se renderiza
// desde el cuerpo del layout (no desde __root) para que /login, que no usa este
// shell, conserve su propio fondo y su propio reset.
const cssLayout = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--os-bg);
    color: var(--os-text);
    font-family: var(--os-font-body);
    -webkit-font-smoothing: antialiased;
    min-height: 100dvh;
  }
  h1, h2, h3, h4, h5, h6 { font-family: var(--os-font-display); }
  a { color: inherit; }

  /* ── Command bar (desktop/tablet) ── */
  .os-cmdbar {
    position: sticky; top: 0; z-index: 100;
    height: 44px; display: flex; align-items: center;
    background: var(--os-bg-sunken);
    border-bottom: 1px solid var(--os-line-accent);
    flex-shrink: 0;
  }
  .cmd-brand {
    width: 196px; flex-shrink: 0; display: flex; align-items: center; gap: 8px;
    padding: 0 1rem 0 1.125rem; height: 100%;
    border-right: 1px solid var(--os-line-soft);
  }
  .cmd-mode {
    display: inline-flex; align-items: center; gap: 5px;
  }
  .cmd-mode .material-symbols-outlined {
    font-size: 16px; color: var(--os-accent-light);
    animation: os-pulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
  }
  .cmd-mode-label {
    font-family: var(--os-font-display); font-size: 11px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--os-accent-light);
  }
  /* Wordmark real (public/fa_logo_*.svg, Ultramarine v5). Dos variantes por
     tema en vez de filtro CSS: los SVG traen colores propios (ultramarine
     para claro, blanco para oscuro), no son monocromo invertible. */
  .cmd-logo { height: 15px; width: auto; display: block; }
  .cmd-logo-dark { display: none; }
  [data-theme="dark"] .cmd-logo-light { display: none; }
  [data-theme="dark"] .cmd-logo-dark { display: block; }
  .cmd-sep { width: 1px; height: 12px; background: var(--os-line); }
  .cmd-name {
    font-family: var(--os-font-display); font-size: 11px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--os-muted);
  }
  .cmd-center {
    flex: 1; display: flex; align-items: center; gap: 10px;
    padding: 0 1rem; min-width: 0; height: 100%;
    border-right: 1px solid var(--os-line-soft); overflow: hidden;
  }
  .cmd-day-pill {
    display: inline-flex; align-items: center; padding: 3px 10px;
    border-radius: 5px; font-family: var(--os-font-display);
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; flex-shrink: 0;
    background: rgba(59,78,217,0.14);
  }
  .cmd-right { display: flex; align-items: center; gap: 10px; padding: 0 0.875rem; height: 100%; flex-shrink: 0; }
  .cmd-capture {
    display: flex; align-items: center;
    background: var(--os-fill-subtle);
    border: 1px solid var(--os-line-soft);
    border-radius: 7px; overflow: hidden;
  }
  .cmd-capture input {
    background: transparent; border: none; outline: none;
    padding: 6px 8px; font-size: 12px; color: var(--os-text);
    font-family: var(--os-font-body); width: 190px; min-height: 32px;
  }
  .cmd-capture input::placeholder { color: var(--os-muted); }
  .cmd-quick-mode {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; flex-shrink: 0; background: transparent;
    border: none; border-right: 1px solid var(--os-line-soft);
    color: var(--os-accent-light); cursor: pointer; padding: 0;
  }
  .cmd-quick-mode .material-symbols-outlined { font-size: 17px; }
  .cmd-quick-mode:hover { background: var(--os-hover); }
  .cmd-logout {
    font-size: 11px; color: var(--os-muted); text-decoration: none;
    font-family: var(--os-font-display); letter-spacing: 0.06em;
    text-transform: uppercase; font-weight: 600; transition: color 0.14s;
    padding: 3px 6px; border-radius: 4px; border: 1px solid var(--os-line-soft);
  }
  .cmd-logout:hover { color: var(--os-text); border-color: var(--os-line); }

  /* ── Theme toggle ── */
  .os-theme-toggle {
    display: inline-flex; align-items: center; justify-content: center;
    background: none; border: 1px solid var(--os-line);
    border-radius: var(--os-r-sm); color: var(--os-muted);
    cursor: pointer; width: 36px; height: 36px; padding: 0; flex-shrink: 0;
    transition: background 0.14s, color 0.14s, border-color 0.14s;
  }
  .os-theme-toggle:hover { background: var(--os-hover); color: var(--os-text); border-color: var(--os-line-accent); }
  .os-theme-toggle .material-symbols-outlined { font-size: 16px; }

  /* Que icono se ve lo decide el atributo data-theme del <html>, que el script
     anti-FOUC de __root.tsx ya dejo puesto antes del primer paint. En el .astro
     esto lo hacia JS tocando style.display, lo que obligaba a esperar a que el
     bundle cargara. */
  [data-os-theme-icon] { display: none; }
  [data-theme="dark"] [data-os-theme-icon="sun"] { display: flex; }
  [data-theme="light"] [data-os-theme-icon="moon"] { display: flex; }

  /* ── Mobile topbar ── */
  .os-topbar {
    display: none; align-items: center; justify-content: space-between;
    padding: 0 0.875rem 0 1rem; background: var(--os-bg-sunken);
    border-bottom: 1px solid var(--os-line-accent);
    height: 44px; position: sticky; top: 0; z-index: 100; flex-shrink: 0;
  }
  .os-topbar-title { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .os-topbar-jugador { display: none; justify-content: flex-end; }

  /* ── Shell ── */
  .os-shell { display: flex; min-height: calc(100dvh - 44px); }

  /* ── Sidebar ── */
  .os-sidebar {
    width: 196px; flex-shrink: 0; background: var(--os-bg-sunken);
    border-right: 1px solid var(--os-line-soft);
    display: flex; flex-direction: column; overflow-y: auto;
    position: sticky; top: 44px; height: calc(100dvh - 44px);
  }

  /* ── Main ── */
  .os-main {
    flex: 1; min-width: 0; overflow-y: auto; position: relative;
    background-image:
      linear-gradient(rgba(59,78,217,0.013) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,78,217,0.013) 1px, transparent 1px);
    background-size: 36px 36px;
  }
  .os-glow {
    position: absolute; top: 0; left: 0; right: 0; height: 360px;
    background: radial-gradient(ellipse 80% 100% at 50% 0%, rgba(59,78,217,0.06) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
  }
  /* En oscuro la grilla/glow recupera su intensidad original */
  [data-theme="dark"] .os-main {
    background-image:
      linear-gradient(rgba(59,78,217,0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,78,217,0.022) 1px, transparent 1px);
  }
  [data-theme="dark"] .os-glow {
    background: radial-gradient(ellipse 80% 100% at 50% 0%, rgba(59,78,217,0.10) 0%, transparent 70%);
  }
  .os-content { position: relative; z-index: 1; padding: 2rem 2.5rem; max-width: 1200px; }

  /* ── Nav ── */
  .nav-group-label {
    font-family: var(--os-font-display); font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(107,114,128,0.8); padding: 0 0.625rem; margin-bottom: 2px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 0.35rem 0.625rem; min-height: 40px; border-radius: 7px;
    font-size: 13px; color: var(--os-muted); background: transparent;
    border-left: 2px solid transparent; text-decoration: none;
    transition: color 0.14s, background 0.14s; white-space: nowrap; letter-spacing: 0.01em;
  }
  .nav-item:hover { color: var(--os-text); background: var(--os-fill-subtle); }
  .nav-item.active { color: var(--os-text); font-weight: 600; background: rgba(59,78,217,0.13); border-left-color: var(--os-accent); }
  .nav-item .material-symbols-outlined { font-size: 18px; color: rgba(107,114,128,0.8); flex-shrink: 0; }
  .nav-item.active .material-symbols-outlined { color: var(--os-accent-light); }

  /* ── Mobile drawer (Mas) ── */
  .os-mobile-nav { display: none; position: fixed; inset: 0; z-index: 200; flex-direction: row; }
  .os-mobile-nav-inner {
    width: 264px; background: var(--os-bg-sunken); height: 100%; overflow-y: auto;
    display: flex; flex-direction: column; border-right: 1px solid var(--os-line);
    animation: os-fade-up 0.2s ease-out;
  }
  .os-overlay { flex: 1; background: rgba(0,0,0,0.65); backdrop-filter: blur(2px); }
  .menu-btn { background: none; border: none; cursor: pointer; color: var(--os-text); padding: 5px; display: flex; align-items: center; }

  /* ── Bottom nav (movil) ── */
  .os-bottomnav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 150;
    height: calc(72px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--os-bg-sunken);
    border-top: 1px solid var(--os-line);
    box-shadow: 0 -6px 20px rgba(14,23,56,0.28);
    align-items: stretch; justify-content: space-around;
  }
  .bn-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; color: var(--os-muted); text-decoration: none; background: none; border: none;
    cursor: pointer; transition: color 0.15s, transform 0.15s; padding: 8px 0;
  }
  .bn-item .material-symbols-outlined { font-size: 23px; }
  .bn-label { font-family: var(--os-font-display); font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .bn-item:active { transform: scale(0.9); }
  .bn-item.active { color: var(--os-accent-light); }
  .bn-item.active .material-symbols-outlined { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

  /* ── Responsive ── */
  @media (max-width: 820px) {
    .os-sidebar { display: none; }
    .os-cmdbar { display: none; }
    .os-topbar { display: flex; }
    .os-topbar-jugador { display: flex; }
    .os-bottomnav { display: flex; }
    .os-content { padding: 1.25rem 1rem calc(72px + 1.5rem + env(safe-area-inset-bottom, 0px)); }
    .os-main { background-size: 30px 30px; }
    .os-shell { min-height: calc(100dvh - 44px); }
    .os-theme-toggle { width: 44px; height: 44px; }
    .os-theme-toggle .material-symbols-outlined { font-size: 20px; }
    /* Items de nav (drawer movil): area tactil de 48px */
    .nav-item { min-height: 48px; }
  }
`;

// OSJugadorBar y TaskiBubble leen sessionStorage/localStorage en su primer
// render. En Astro cada uno era una isla aislada; aca comparten arbol con toda
// la pagina, asi que un desajuste de hidratacion suyo tumbaria la hidratacion
// entera. Se montan solo en cliente, que es el equivalente React de client:only.
function SoloCliente({ children }: { children: ReactNode }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? <>{children}</> : null;
}

// ── Tema ──
const OS_THEME_KEY = 'os-theme';
const OS_LIGHT_COLOR = '#FAFAF7';
const OS_DARK_COLOR = '#060C1E';

function alternarTema() {
  const actual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const siguiente = actual === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', siguiente);
  try {
    localStorage.setItem(OS_THEME_KEY, siguiente);
  } catch {
    // localStorage bloqueado (modo privado): el tema vale solo para esta vista.
  }
  document
    .getElementById('os-theme-color-meta')
    ?.setAttribute('content', siguiente === 'dark' ? OS_DARK_COLOR : OS_LIGHT_COLOR);
}

function BotonTema() {
  return (
    <button type="button" className="os-theme-toggle" onClick={alternarTema} aria-label="Cambiar tema">
      <span className="material-symbols-outlined" data-os-theme-icon="sun">light_mode</span>
      <span className="material-symbols-outlined" data-os-theme-icon="moon">dark_mode</span>
    </button>
  );
}

// ── Chat con el cerebro ──
type TurnoChat = { role: 'user' | 'brain' | 'error'; text: string };
const CHAT_KEY = 'os-chat-history';

export interface OSLayoutProps {
  /** Titulo corto de la seccion. Se ve en la barra superior de movil. */
  title: string;
  children: ReactNode;
}

export default function OSLayout({ title, children }: OSLayoutProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // El dia de la semana depende de la zona horaria de quien mira, y el servidor
  // corre en UTC. Se renderiza con la del servidor y se corrige al montar, que
  // es lo unico honesto sin pedirle la zona al cliente antes del primer paint.
  const [diaHoy, setDiaHoy] = useState(() => DIAS[new Date().getDay()]);
  useEffect(() => setDiaHoy(DIAS[new Date().getDay()]), []);
  const tipoDia = datosDaily.semana.find((d) => d.dia === diaHoy)?.tipo ?? 'manager';

  const [drawerAbierto, setDrawerAbierto] = useState(false);
  // El drawer se cierra solo al navegar: en Astro cada click recargaba la
  // pagina entera y lo desmontaba, aca el shell sobrevive a la navegacion.
  useEffect(() => setDrawerAbierto(false), [pathname]);

  // Registro del service worker (PWA), identico al del .astro.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);

  // ── Chat con el cerebro ──
  // /api/preguntar y /api/capturar ya son server routes de TanStack
  // (src/routes/api/preguntar.ts y src/routes/api/capturar.ts).
  const [chatAbierto, setChatAbierto] = useState(false);
  const [historial, setHistorial] = useState<TurnoChat[]>([]);
  const [pendiente, setPendiente] = useState(false);
  const [preguntaInput, setPreguntaInput] = useState('');
  const cuerpoChatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setHistorial(JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? '[]') as TurnoChat[]);
    } catch {
      setHistorial([]);
    }
  }, []);

  useEffect(() => {
    const el = cuerpoChatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [historial, pendiente, chatAbierto]);

  const guardarHistorial = useCallback((turnos: TurnoChat[]) => {
    setHistorial(turnos);
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(turnos.slice(-50)));
    } catch {
      // sessionStorage no disponible: la conversacion vive solo en memoria.
    }
  }, []);

  const preguntarAlCerebro = useCallback(async (pregunta: string) => {
    const q = pregunta.trim();
    if (!q) return;
    let turnos: TurnoChat[] = [...historial, { role: 'user', text: q }];
    guardarHistorial(turnos);
    setChatAbierto(true);
    setPendiente(true);
    try {
      const res = await fetch('/api/preguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q }),
      });
      const data: { respuesta?: string; error?: string } = await res.json();
      turnos = data.error
        ? [...turnos, { role: 'error', text: 'Error: ' + data.error }]
        : [...turnos, { role: 'brain', text: data.respuesta ?? '(sin respuesta)' }];
    } catch {
      turnos = [...turnos, { role: 'error', text: 'Error de conexion.' }];
    }
    setPendiente(false);
    guardarHistorial(turnos);
  }, [historial, guardarHistorial]);

  // ── Captura rapida unificada (un input, conmutador preguntar/capturar) ──
  const [quickMode, setQuickMode] = useState<'preguntar' | 'capturar'>('preguntar');
  const [quickValor, setQuickValor] = useState('');
  const [quickAviso, setQuickAviso] = useState('');
  const quickRef = useRef<HTMLInputElement | null>(null);

  const placeholderQuick = quickAviso
    || (quickMode === 'preguntar' ? 'Preguntar al cerebro...' : 'Capturar idea...');

  const capturar = useCallback(async (texto: string) => {
    setQuickAviso('Guardando...');
    try {
      const res = await fetch('/api/capturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      setQuickAviso(res.ok && data.ok ? 'Guardado en el cerebro' : 'Error al guardar');
    } catch {
      setQuickAviso('Error al guardar');
    }
    setTimeout(() => setQuickAviso(''), 1800);
  }, []);

  function onQuickKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = quickValor.trim();
    if (quickMode === 'preguntar') {
      if (!v) { setChatAbierto(true); return; }
      setQuickValor('');
      preguntarAlCerebro(v);
    } else {
      if (!v) return;
      setQuickValor('');
      capturar(v);
    }
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname === href + '/';

  // Los enlaces de nav son <a> y no <Link> a proposito: durante la migracion la
  // mayoria de estos destinos siguen siendo paginas de Astro, y <Link> exige que
  // la ruta exista en el arbol de TanStack. Se cambian a <Link> a medida que
  // cada pagina se porta.
  const listaNav = (claveGrupo: string) => navGroups.map((group) => (
    <div key={`${claveGrupo}-${group.label}`} style={{ padding: '0.875rem 0.5rem 0.125rem' }}>
      <p className="nav-group-label" style={claveGrupo === 'drawer' ? { marginBottom: 3 } : undefined}>
        {group.label}
      </p>
      {group.items.map((item) => (
        <a key={item.href} href={item.href} className={`nav-item${isActive(item.href) ? ' active' : ''}`}>
          <span className="material-symbols-outlined">{ms[item.href] ?? 'circle'}</span>
          {item.label}
        </a>
      ))}
    </div>
  ));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssLayout }} />

      {/* Desktop command bar */}
      <header className="os-cmdbar">
        <div className="cmd-brand">
          <span className="cmd-mode">
            <span className="material-symbols-outlined">bolt</span>
            <span className="cmd-mode-label">OS</span>
          </span>
          <span className="cmd-sep" />
          <img className="cmd-logo cmd-logo-light" src="/fa_logo_dark.svg" alt="Francisco Abad" />
          <img className="cmd-logo cmd-logo-dark" src="/fa_logo_whitemono.svg" alt="Francisco Abad" />
        </div>

        <div className="cmd-center">
          {/* El Domino del dia ya vive en el dashboard (Hoy); aqui queda solo
              como tooltip del pill de modo para no cargar la barra. */}
          <span
            className="cmd-day-pill"
            style={{ color: tipoColor[tipoDia] }}
            title={`Domino de hoy: ${DOMINO_TEXTO}`}
            suppressHydrationWarning
          >
            {tipoLabel[tipoDia]}
          </span>
        </div>

        <div className="cmd-right">
          {/* Captura rapida unificada: un solo input con conmutador
              preguntar al cerebro / capturar idea. */}
          <div className="cmd-capture">
            <button
              type="button"
              className="cmd-quick-mode"
              onClick={() => {
                setQuickMode((m) => (m === 'preguntar' ? 'capturar' : 'preguntar'));
                quickRef.current?.focus();
              }}
              title="Cambiar entre preguntar y capturar"
              aria-label="Cambiar entre preguntar y capturar"
            >
              <span className="material-symbols-outlined">
                {quickMode === 'preguntar' ? 'psychology' : 'edit_note'}
              </span>
            </button>
            <input
              ref={quickRef}
              type="text"
              value={quickValor}
              onChange={(e) => setQuickValor(e.target.value)}
              onKeyDown={onQuickKeyDown}
              placeholder={placeholderQuick}
              maxLength={400}
            />
          </div>
          <SoloCliente><OSJugadorBar /></SoloCliente>
          <BotonTema />
          <a href="/api/os-auth?action=logout" className="cmd-logout" title="Cerrar sesion">salir</a>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="os-topbar">
        <span className="cmd-mode">
          <span className="material-symbols-outlined">bolt</span>
          <span className="cmd-mode-label" suppressHydrationWarning>{tipoLabel[tipoDia]}</span>
        </span>
        <span className="os-topbar-title">
          <span style={{ fontSize: 12, color: 'var(--os-text)', fontFamily: 'var(--os-font-display)', fontWeight: 600 }}>
            {title}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <BotonTema />
          <button className="menu-btn" onClick={() => setChatAbierto(true)} aria-label="Preguntar al cerebro">
            <span className="material-symbols-outlined" style={{ fontSize: 21, color: 'var(--os-muted)' }}>search</span>
          </button>
        </div>
      </header>
      <div className="os-topbar-jugador">
        <SoloCliente><OSJugadorBar /></SoloCliente>
      </div>

      {/* Mobile nav drawer (Mas) */}
      {drawerAbierto && (
        <div className="os-mobile-nav" style={{ display: 'flex' }}>
          <div className="os-mobile-nav-inner">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid var(--os-line-soft)' }}>
              <span className="cmd-mode">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                <span className="cmd-mode-label">OS · Pancho</span>
              </span>
              <button className="menu-btn" onClick={() => setDrawerAbierto(false)} aria-label="Cerrar menu">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--os-muted)' }}>close</span>
              </button>
            </div>
            {listaNav('drawer')}
            <div style={{ marginTop: 'auto', padding: '0.875rem 1rem', borderTop: '1px solid var(--os-line-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/" style={{ fontSize: 11, color: 'var(--os-muted)', textDecoration: 'none' }}>franciscoabad.com</a>
              <a href="/api/os-auth?action=logout" style={{ fontSize: 11, color: 'var(--os-muted)', textDecoration: 'none' }}>Cerrar sesion</a>
            </div>
          </div>
          <div className="os-overlay" onClick={() => setDrawerAbierto(false)} />
        </div>
      )}

      {/* Chat con el cerebro */}
      {chatAbierto && (
        <div style={{ display: 'flex', position: 'fixed', top: 44, right: 0, zIndex: 160, width: 420, maxWidth: '100vw', background: 'var(--os-surface-2)', border: '1px solid var(--os-line-accent)', borderBottomLeftRadius: 10, boxShadow: 'var(--os-shadow-modal)', flexDirection: 'column', maxHeight: 'calc(100dvh - 44px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 1rem', borderBottom: '1px solid var(--os-line-soft)', flexShrink: 0 }}>
            <span className="os-eyebrow">Chat con el cerebro</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => guardarHistorial([])}
                style={{ background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--os-font-display)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: 0 }}
                title="Limpiar conversacion"
              >
                Limpiar
              </button>
              <button
                onClick={() => setChatAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--os-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
                title="Cerrar"
              >
                ×
              </button>
            </div>
          </div>
          <div
            ref={cuerpoChatRef}
            style={{ padding: '0.875rem 1rem', fontSize: 13, color: 'var(--os-text-2)', lineHeight: 1.65, overflowY: 'auto', flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {!historial.length && !pendiente && (
              <p style={{ color: 'var(--os-muted)', fontSize: 12, margin: 'auto', textAlign: 'center' }}>
                Pregunta lo que quieras. El cerebro recuerda esta conversacion.
              </p>
            )}
            {historial.map((t, i) => {
              if (t.role === 'user') {
                return (
                  <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--os-accent)', color: '#fff', padding: '7px 11px', borderRadius: '10px 10px 2px 10px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                    {t.text}
                  </div>
                );
              }
              if (t.role === 'error') {
                return (
                  <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%', color: 'var(--os-error)', fontSize: 12, padding: '2px 0' }}>
                    {t.text}
                  </div>
                );
              }
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '90%', background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line-soft)', color: 'var(--os-text-2)', padding: '8px 11px', borderRadius: '10px 10px 10px 2px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {t.text}
                </div>
              );
            })}
            {pendiente && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--os-muted)', fontSize: 12, padding: '2px 0' }}>
                Consultando el cerebro...
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0.625rem 0.75rem', borderTop: '1px solid var(--os-line-soft)', flexShrink: 0 }}>
            <input
              type="text"
              value={preguntaInput}
              onChange={(e) => setPreguntaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const q = preguntaInput.trim();
                if (!q) return;
                setPreguntaInput('');
                preguntarAlCerebro(q);
              }}
              placeholder="Escribe tu pregunta..."
              maxLength={400}
              style={{ flex: 1, background: 'var(--os-fill-subtle)', border: '1px solid var(--os-line)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--os-text)', fontFamily: 'var(--os-font-body)', outline: 'none' }}
            />
            <button
              className="os-btn"
              onClick={() => {
                const q = preguntaInput.trim();
                if (!q) return;
                setPreguntaInput('');
                preguntarAlCerebro(q);
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <div className="os-shell">
        {/* Desktop sidebar */}
        <nav className="os-sidebar">
          {listaNav('sidebar')}
          <div style={{ marginTop: 'auto', padding: '0.875rem 0.875rem 1rem', borderTop: '1px solid var(--os-line-soft)' }}>
            <a href="/" style={{ display: 'block', fontSize: 11, color: 'rgba(107,114,128,0.6)', textDecoration: 'none', letterSpacing: '0.03em' }}>
              franciscoabad.com
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main className="os-main">
          <div className="os-glow" aria-hidden="true" />
          <div className="os-content">{children}</div>
        </main>
      </div>

      {/* Taski: burbuja de chat directo con Hermes (visible en todo el OS) */}
      <SoloCliente><TaskiBubble /></SoloCliente>

      {/* Bottom nav (movil) */}
      <nav className="os-bottomnav">
        {bottomNav.map((item) => (
          <a key={item.href} href={item.href} className={`bn-item${isActive(item.href) ? ' active' : ''}`}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </a>
        ))}
        <button className="bn-item" type="button" onClick={() => setDrawerAbierto(true)} aria-label="Mas secciones">
          <span className="material-symbols-outlined">apps</span>
          <span className="bn-label">Mas</span>
        </button>
      </nav>
    </>
  );
}
