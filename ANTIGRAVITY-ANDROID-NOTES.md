# Antigravity para la APK de Pancho OS

Notas de research (22-ago-2026) para cuando Pancho arranque el proyecto
Android nativo en Antigravity. Web + escritorio primero, esto despues.

## Que es Antigravity

Plataforma de desarrollo agentico de Google (I/O 2026), potenciada por
Gemini 3 Pro/3.5 Flash. No es un fork de VS Code con un plugin encima:
invierte la arquitectura para que los agentes orquesten todo el flujo
(planear, codear, probar, validar) de punta a punta.

5 componentes: app de escritorio standalone, un CLI nuevo, un SDK de
desarrollador, un tier de Managed Agents dentro de la API de Gemini, y un
camino de despliegue enterprise.

Soporta multiples modelos, no solo Gemini: Claude Sonnet 4.5 y GPT-OSS
tambien corren ahi.

## Por que conviene para Android especificamente

Esto es lo que la hace mejor opcion que seguir con Claude Code para esta
pieza puntual:

- **Android CLI 1.0**: le da a los agentes acceso a tareas que hoy exigen
  tener Android Studio abierto -- gestion del SDK, conectividad de
  dispositivo/emulador, resolucion semantica de simbolos, analisis de
  archivos, renderizado de preview de Compose, y ejecucion de UI tests.
- El CLI es agnostico de agente (lo puede invocar Claude Code, Codex o
  Antigravity), pero Antigravity es quien mas lo integra de forma nativa
  hoy.
- **Publish directo**: puede generar apps Android desde un prompt y
  publicarlas directo al test track de Google Play Console.
- Integracion con Firebase y con Google AI Studio (mobile app disponible,
  proyectos migran de AI Studio a Antigravity local con un click).

## Como esto encaja con lo que ya existe

El punto de partida NO es cero: cuando Pancho llegue a esto, la web ya va
a estar en TanStack Start (no Astro), con:

- Patron de paginas ya documentado (`docs/tanstack-migration-pattern.md`)
  para lo que falte portar.
- El servidor MCP (`src/mcp/engine.ts` + rutas TanStack) como interfaz
  unica de datos -- la APK deberia consumirlo igual que el escritorio, no
  inventar su propio cliente REST paralelo.
- El patron de auth por dispositivo pensado para escritorio
  (`os_devices`, pairing con codigo corto) es el mismo que deberia
  extenderse al celular en vez de crear uno nuevo.
- `src/lib/desktopBridge.ts` es el precedente de como aislar "solo corre
  si estoy en la app nativa" sin romper el uso normal por navegador/PWA
  -- un patron equivalente (`isAndroid()` o similar) tiene sentido del
  lado Android.

## Fuentes

- [Google I/O 2026 Mobile Playbook — GeekyAnts](https://geekyants.com/blog/google-io-2026-mobile-playbook-ai-studio-android-cli-and-antigravity-for-app-development)
- [Antigravity 2.0 — Android Headlines](https://www.androidheadlines.com/2026/05/google-io-2026-antigravity-developer-tools-ai-studio-mobile-app.html)
- [Google Antigravity — desarrolladores de Google](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
