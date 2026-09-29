# Plan: Hermes completo dentro de Pancho OS

Fecha: 28-sep-2026. Pedido de Pancho: tener en Pancho OS todo lo de Hermes (chat, Capabilities con skills, pantalla del bot en modo "bot mode", tareas programadas), poder diferenciar sesiones, una réplica manejable de sus grupos de Telegram con topics, y que todo sea responsive para la app.

## Lo que hay hoy (verificado)

| Pieza | Dónde | Qué tiene |
|---|---|---|
| App de escritorio de Hermes | `C:\Users\Francisco\AppData\Local\hermes\hermes-agent\apps\desktop` | Capabilities (skills, plugins, MCP), pantalla del bot (`Screen :20 1440x900`, "Hand back"), tareas programadas, sesiones. Electron 40 + React 19 + Tailwind 4 + TanStack Query + nanostores. |
| Panel web de Hermes | `C:\Users\Francisco\AppData\Local\hermes\hermes-agent\web` | 20 páginas: Chat, Sesiones, Cron, Skills, MCP, Modelos, Perfiles, Canales, Logs, Archivos, Config, Env, etc. React 19 + Vite 8 + Tailwind 4. |
| Backend que usan las dos | VPS, `hermes-remote-backend.service`, `http://100.127.42.51:9119` (solo Tailscale) | Modo `dashboard` desde el 28-sep, con login (usuario `pancho`). |
| Hermes en Pancho OS | `C:\DEV\Pancho-OS\src\routes\hermes.tsx`, `C:\DEV\Pancho-OS\src\os\components\OSHermesCockpit.tsx`, `C:\DEV\Pancho-OS\src\os\components\OSChat.tsx`, `C:\DEV\Pancho-OS\src\os\lib\sesiones.ts`, `C:\DEV\Pancho-OS\src\os\lib\perfilesHermes.ts` | Chat con streaming, perfiles reales, topic por sesión, notificaciones (F1 a F4). |

Licencia de Hermes: MIT. Se puede copiar y adaptar citando la licencia.

**El hallazgo que define el plan:** la app de escritorio llama 517 veces, en 193 archivos, a `window.hermesDesktop`, el puente con Electron. Para que corra en un navegador hay que escribir un reemplazo web de ese puente (un "shim") que mande las mismas llamadas al backend por HTTP y WebSocket. Es posible, pero no es copiar y pegar.

## Estrategia recomendada: espejo del código de Hermes más módulos propios

No se reescribe Hermes. Se compila el código oficial de la app de escritorio como web, con el shim, y se sirve dentro del OS. Encima se construye lo que Hermes no tiene: topics de Telegram y la vista móvil.

Por qué: Hermes cambia cientos de veces por semana. Una copia reescrita queda vieja en días. Un espejo compilado desde el código oficial se actualiza con un script.

## Fases

### Fase 0. Prueba de viabilidad (1 día) → decide si seguimos
1. Compilar `apps/desktop` (solo el renderer, sin Electron) con Vite en modo web.
2. Escribir `hermesDesktop-shim.ts`: implementa `window.hermesDesktop.api(...)` y los demás métodos con `fetch` y WebSocket contra el backend. Los métodos que solo tienen sentido en escritorio (abrir carpetas, guardar archivos locales, auto-actualizar) quedan como "no disponible".
3. Probar contra el VPS: chat, sesiones, Capabilities, tareas programadas y la pantalla del bot.
4. **Puerta de decisión:** si funciona el 80% con menos de 300 líneas de shim, se sigue. Si no, se pasa al Plan B (abajo).

### Fase 1. Hermes completo en el OS (2 a 3 días)
1. Script `scripts/sync-hermes-ui.ps1`: toma el código de `apps/desktop` de la versión que tiene el backend (no la última de GitHub), aplica el shim, compila y copia el resultado a `public/hermes-app/`. Así se actualiza con un comando.
2. Proxy en el servidor de Pancho OS: `/api/hermes-ui/*` → `100.127.42.51:9119`. El OS pone el login del dashboard por detrás; la clave nunca llega al navegador.
3. Ruta `/hermes/app` dentro del OS, protegida por el login del OS.
4. Pantalla del bot: verificar que el stream de la pantalla (WebSocket) pase por el proxy.
5. Cero cambios en el VPS salvo, si hace falta, permitir el origen del OS.

### Fase 2. Sesiones diferenciadas (1 día)
1. Lista de sesiones agrupada por canal (Telegram, Desktop, OS, cron, A2A, WhatsApp) y por perfil (Alfred, Ara, Nerio, Taskr, Rafik).
2. Fuente: `state.db` del VPS, tablas `sessions` (`source`, `title`, `id`) y `messages`, leídas por la API del backend.
3. Buscador y filtro. Nombre, color e ícono por canal.

### Fase 3. Réplica de los grupos de Telegram con topics (2 a 3 días)
1. Vista "Telegram" en el OS: grupos → topics → conversación, igual que en Telegram.
2. Lectura: las sesiones de Telegram guardan el grupo y el topic en su clave (ejemplo: grupo Pancho HQ `-1004384794270`, topic Desktop `1279`).
3. Escritura desde el OS: mandar un mensaje a un topic (que Alfred lo reciba y responda como si vinieras de Telegram), crear un topic, renombrarlo y cerrarlo (API de Telegram: `createForumTopic`, `editForumTopic`, `closeForumTopic`).
4. Tiempo real: los mensajes nuevos aparecen sin recargar, con el mismo mecanismo de eventos que ya usa el OS.
5. El espejo del Desktop al topic 1279 (`hermes-desktop-mirror.service` en el VPS) sigue igual.

### Fase 4. Responsive y app (2 días)
1. La app de escritorio de Hermes no está pensada para celular. Para móvil, el OS usa vistas propias: sesiones, chat, topics de Telegram y Capabilities (ver y activar skills).
2. En pantallas grandes se muestra el espejo completo de Hermes (Fase 1).
3. Probar en la app Android de Pancho OS (`C:\DEV\Pancho-OS\Android`) y en la app de escritorio de Tauri (`C:\DEV\Pancho-OS\src-tauri`).

## Plan B (si la Fase 0 falla)
Construir en el OS pantallas propias (Capabilities, tareas programadas, sesiones y pantalla del bot) contra la API del backend, reusando componentes del panel web (`web/src/pages/SkillsPage.tsx`, `web/src/pages/CronPage.tsx`, `web/src/pages/SessionsPage.tsx`). Tarda más (8 a 12 días) y hay que mantenerlo a mano.

## Riesgos y cómo se cubren
1. **Seguridad:** el panel de Hermes permite ver claves, editar configuración y usar la terminal. Exponerlo por internet en `os.franciscoabad.com` es un riesgo alto. Mitigación: la ruta `/hermes/app` pide el login del OS más un segundo factor, o se limita a la red de Tailscale. Decisión pendiente en `C:\DEV\Pancho-OS\docs\DECISIONES-PENDIENTES.md`.
2. **Versión:** el espejo debe compilarse desde la misma versión que corre el backend del VPS, no desde la última de GitHub, o fallará por cambios en la API.
3. **Actualizaciones:** nunca usar el botón "Update" del espejo, porque actualiza el VPS. El shim debe desactivarlo.
4. **Dos sesiones tocando el VPS:** todo cambio en el VPS se anota en `/root/CAMBIOS.md`.

## Cómo se ejecuta
En una sesión aparte de Claude Code en `C:\DEV\Pancho-OS`, empezando por la Fase 0. Al final de cada fase: tests, build, prueba en el navegador y reporte a Pancho.

## Resultado Fase 0 (28-sep-2026)

**Veredicto: pasa la puerta. Propuesta: seguir con la Fase 1.** Funciona el 100% de lo pedido (chat, sesiones, Capabilities, tareas programadas y pantalla del bot) y 12 de 13 funciones web revisadas (92%). El shim tiene 277 líneas (251 sin comentarios ni líneas vacías), por debajo del límite de 300.

### Qué se construyó (carpeta de prueba, nada en producción)
| Pieza | Ruta | Qué hace |
|---|---|---|
| Código de Hermes | `C:\DEV\Pancho-OS\spikes\hermes-web\vendor` (ignorado por git) | `apps/desktop` y `apps/shared` extraídos con `git archive` del commit `e63b6fa`, el mismo del VPS. El repo de Hermes no se tocó. |
| Shim | `C:\DEV\Pancho-OS\spikes\hermes-web\shim\hermes-desktop-shim.js` | Reemplaza `window.hermesDesktop`: `api()` con fetch, WebSocket con ticket de un solo uso, roster de bots del VPS, métodos de escritorio como "no disponible", Update desactivado. |
| Servidor de prueba | `C:\DEV\Pancho-OS\spikes\hermes-web\server.mjs` (160 líneas) | Sirve el build, inyecta el shim y hace de proxy `/hermes-api` al VPS (HTTP y WebSocket). Hace el login del dashboard por detrás: la clave nunca llega al navegador. Bloquea actualizar y reiniciar el VPS. |
| Capturas | `C:\DEV\Pancho-OS\spikes\hermes-web\capture.mjs` | Chromium headless de Playwright, sin ventanas. |
| Arranque | `C:\DEV\Pancho-OS\.claude\launch.json`, configuración `hermes-web-spike` | Puerto 4390, solo en `127.0.0.1`. |

Build: 1062 archivos, 41,5 MB, 48 s con Vite 8.

### Qué funciona (probado contra el VPS real)
| # | Función | Resultado | Captura |
|---|---|---|---|
| 1 | Arranque y login al dashboard por el proxy | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\01-inicio-sesiones.png` |
| 2 | Chat: enviar, streaming y respuesta de Alfred | Funciona (4 pruebas) | `C:\DEV\Pancho-OS\docs\fase0-capturas\02-chat-respuesta-del-vps.png` |
| 3 | Sesiones: lista, grupos Telegram, API y Cron, abrir una sesión de Telegram con sus tarjetas de herramientas | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\07-sesion-de-telegram.png` |
| 4 | Bots por perfil (Hermes, Arazza, Arazza Ads, Rafik, Nerio, Taskr) | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\08-bots-por-perfil.png` |
| 5 | Capabilities, Skills (264) | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\03-capabilities-skills.png` |
| 6 | Capabilities, Conectores MCP (Approval, Cerebro, n8n, Pancho OS y catálogo de 65) y Tools (25) | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\04-capabilities-conectores-mcp.png` |
| 7 | Capabilities, Plugins | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\05-capabilities-plugins.png` |
| 8 | Tareas programadas: 25 tareas, detalle, prompt e historial | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\06-tareas-programadas.png` |
| 9 | Pantalla del bot en vivo (`:20 · 1440x900`, noVNC por el proxy) | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\09-pantalla-del-bot.png` |
| 10 | Take over y Hand back | Funciona | `C:\DEV\Pancho-OS\docs\fase0-capturas\10-pantalla-del-bot-tomada-hand-back.png` |
| 11 | Messaging (canales por perfil) | Funciona | sin captura |
| 12 | Botón Update desactivado | Funciona: el diálogo dice que el VPS se actualiza por SSH y no hay "Update now". El proxy responde 403 a `POST /api/hermes/update` y `POST /api/gateway/restart`. | `C:\DEV\Pancho-OS\docs\fase0-capturas\11-update-desactivado.png` |
| 13 | Adjuntar archivos del computador al chat | No funciona: depende de rutas locales de Electron (`getPathForFile`, `readFileDataUrl`) | pendiente Fase 1 |

No aplican en web (quedan "no disponible" a propósito): terminal local, árbol de archivos y git del proyecto, HUD, mascota flotante, entrada rápida, ventanas extra, capturas nativas.

No probado a propósito porque cambia el VPS: pausar o ejecutar tareas, activar skills, instalar conectores.

VPS al cierre: sigue en `e63b6fa` y `hermes-remote-backend.service` activo. Solo se leyó, salvo los chats de prueba.

### Hallazgos que cambian la Fase 1
1. **Instalar con el lock exacto del monorepo.** Con `npm install` suelto se instalaron 128 paquetes en otra versión (`@assistant-ui/tap` 0.9.19 en vez de 0.9.8) y el chat se caía con "Maximum update depth exceeded". Con `npm ci --workspace apps/desktop --workspace web --include-workspace-root` desde el `package-lock.json` del mismo commit, el fallo desapareció.
2. **Dependencia fantasma:** el escritorio usa `lucide-react`, que viene del workspace `web`. Por eso el `npm ci` incluye `web`.
3. **Bots con ruta:** el shim debe devolver los perfiles del VPS en `getAgentRoster` con `connectionId`. Sin eso la pantalla del bot falla con "requires a route descriptor".
4. **Update:** se desactiva con `can_apply: false` en `/api/hermes/update/check` (shim) y bloqueo en el proxy (la barrera real).
5. **Login:** el proxy del OS inicia sesión con `POST /auth/password-login`, guarda las 3 cookies del lado del servidor y pide el ticket del WebSocket con `POST /api/auth/ws-ticket`. Sirve igual para la pantalla del bot (`/api/display/ws`).
6. **Peso:** el build pesa 41,5 MB. No debe ir dentro del repo del OS; el script de sincronización lo genera en el despliegue o en una carpeta ignorada.

### Efectos secundarios en el VPS
Quedaron 3 sesiones de prueba en el perfil default: `20260928_214108_a64129` ("Prueba fase 0 pancho os web", con 2 mensajes), `20260928_214959_630f01` ("Prueba 3") y `20260928_220020_03515d` ("Prueba 4"). Si el espejo del Desktop (`hermes-desktop-mirror.service`) las copió, pueden aparecer en el topic Desktop de Telegram. No se borraron.

### Cómo repetir la prueba
1. Tailscale encendido.
2. Iniciar la configuración `hermes-web-spike` de `C:\DEV\Pancho-OS\.claude\launch.json` y abrir http://127.0.0.1:4390.
3. Capturas: `node C:\DEV\Pancho-OS\spikes\hermes-web\capture.mjs` (oculto, headless).

Decisiones abiertas: `C:\DEV\Pancho-OS\docs\DECISIONES-PENDIENTES.md`.

## Resultado Fase 1 (28-sep-2026)

**Estado: Hermes completo corre en el VPS, solo por Tailscale, en http://100.127.42.51:9120.** Acceso según la decisión 1b = A (solo Tailscale). Desde internet no responde.

### Qué quedó
| Pieza | Ruta | Qué hace |
|---|---|---|
| Build reproducible | `C:\DEV\Pancho-OS\hermes-ui\build.mjs` | Extrae con `git archive` el commit que corre el VPS, `npm ci` con el lock del monorepo, compila y deja `hermes-ui\.work\dist`. No toca el repo de Hermes. |
| Despliegue | `C:\DEV\Pancho-OS\hermes-ui\deploy.ps1` | Lee el commit del VPS, compila en la PC (el VPS tiene poca RAM), sube, activa el servicio, regla ufw solo en `tailscale0`, anota en `/root/CAMBIOS.md`. `-Credenciales` reescribe `/etc/hermes-ui.env` (600) desde la bóveda. |
| Servicio | `C:\DEV\Pancho-OS\hermes-ui\hermes-ui.service` | systemd en el VPS, `DynamicUser`, escucha en `100.127.42.51:9120`. Releases en `/opt/hermes-ui/releases`, se guardan las 3 últimas. |
| Proxy | `C:\DEV\Pancho-OS\hermes-ui\server.mjs` | Login del dashboard del lado del servidor, bloqueo de actualizar y reiniciar (403), sin keep-alive (evita "socket hang up"). |
| Shim | `C:\DEV\Pancho-OS\hermes-ui\shim\hermes-desktop-shim.js` | Ahora también adjunta archivos, imágenes pegadas y el selector de archivos del navegador. |
| Página del OS | `C:\DEV\Pancho-OS\src\routes\hermes_\app.tsx` | `/hermes/app`, "Hermes completo" en el menú Sistema. Abre el servicio en pestaña nueva; se incrusta cuando haya HTTPS de Tailscale (decisión 1b). |

### Probado contra el VPS real
1. Chat desde el servicio del VPS: responde. Captura `C:\DEV\Pancho-OS\docs\fase1-capturas\02-chat-respuesta-del-vps.png`.
2. Adjuntar archivo: Alfred leyó un `.txt` adjunto y devolvió su palabra clave. Cierra el único hueco de la Fase 0.
3. Sesiones, Capabilities, tareas programadas y bots: capturas 01 a 08 en `C:\DEV\Pancho-OS\docs\fase1-capturas\`.
4. Pantalla del bot: el panel abre y ofrece "Start screen" (el escritorio del bot estaba apagado; no se encendió para no gastar RAM). El stream en vivo con Take over y Hand back quedó probado en la Fase 0 con el mismo código.
5. Update: sin botón "Update now" y el proxy responde 403. Captura `C:\DEV\Pancho-OS\docs\fase1-capturas\11-update-desactivado.png`.
6. Página `/hermes/app` del OS probada en local con credenciales de prueba.

### Cambios en el VPS (anotados en /root/CAMBIOS.md)
- Nuevo `hermes-ui.service`, `/opt/hermes-ui`, `/etc/hermes-ui.env` (600), regla ufw `9120/tcp on tailscale0`.
- Rollback: `systemctl disable --now hermes-ui && ufw delete allow in on tailscale0 to any port 9120 proto tcp`.

### Cómo se actualiza cuando Hermes se actualice en el VPS
`powershell -File C:\DEV\Pancho-OS\hermes-ui\deploy.ps1`. Lee la versión nueva del VPS y recompila la misma. Si el VPS se actualiza y no se corre este script, el servicio sigue con el build anterior y puede fallar en partes nuevas de la API.

### Pendiente para Fase 2
Hecho, ver abajo. Después: Fase 3 (Telegram con topics) y Fase 4 (móvil).

## Resultado Fase 2 (29-sep-2026)

**Estado: hecha y probada contra el Hermes real.** Página nueva `/hermes/sesiones` ("Sesiones de Hermes" en el menú Sistema).

### Qué hace
1. Junta las sesiones de los 6 perfiles del VPS (1193 hoy) y las separa por **canal**: Telegram, Pancho OS, Desktop y web, Tareas programadas, Puente de Ara, Tareas de una vez, Terminal y Otros. Cada canal tiene nombre, color e ícono.
2. Filtra por **perfil** (Alfred, Arazza, Nerio, Rafik, Taskr) y busca por título, mensaje, grupo o perfil, sin importar acentos.
3. **Telegram va por grupo y con topic**: por ejemplo "Telegram · Pancho HQ" con sus topics 1, 56, 1279, y "Telegram · Arazza Mealpreps" con el 187. Esto es la base de la Fase 3.
4. Cada sesión se abre en Hermes completo (solo con Tailscale). Funciona en celular (captura 05).

### Cómo está hecho
| Pieza | Ruta |
|---|---|
| Lógica de canales (pura, con 9 pruebas) | `C:\DEV\Pancho-OS\src\os\lib\canalesHermes.ts` |
| Lectura desde Hermes (solo GET, con 5 pruebas) | `C:\DEV\Pancho-OS\src\server\hermesSesiones.handlers.ts` |
| API con sesión del OS (401 sin sesión) | `C:\DEV\Pancho-OS\src\routes\api\hermes\sesiones.ts` |
| Página | `C:\DEV\Pancho-OS\src\routes\hermes_\sesiones.tsx` |

El OS le pregunta a `hermes-ui` (mismo VPS), que ya tiene la sesión del dashboard: no se guardó ninguna clave nueva. Si `hermes-ui` no responde, la página muestra el error, no una lista inventada. Variable opcional: `HERMES_UI_INTERNAL_URL` (por defecto `http://100.127.42.51:9120`).

### Probado
14 de 14 pruebas (`npm run test:sesiones`). Sin errores nuevos de tipos. Página y API probadas en local con el Hermes real. Capturas: `C:\DEV\Pancho-OS\docs\fase2-capturas\` (todas por canal, filtro Telegram con topics, Telegram + Arazza, búsqueda, celular).

### Límites conocidos
1. Carga las 500 sesiones más recientes (tope de Hermes por página). Los conteos por canal son de esas 500; los conteos por perfil son totales. La página lo avisa ("las 501 más recientes de 1193").
2. Abrir una sesión requiere Tailscale, porque Hermes completo es solo Tailscale (decisión 1b = A).
3. Al fusionar, la página aparece en producción. Producción debe alcanzar `100.127.42.51:9120` (mismo VPS): se verifica tras el despliegue.
