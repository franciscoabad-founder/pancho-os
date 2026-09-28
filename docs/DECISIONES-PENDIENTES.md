# Decisiones pendientes: Pancho OS

## 0. OpenRouter: borrar llaves ...769 y ...906 (28-sep-2026)

**Qué decidir:** (a) ¿borro ...769 "Cortex"? (b) ¿borro ...906 "Default key" ahora o después de que generes las llaves nuevas? (c) ¿de quién es ...7c4 (tenant carlos-cardenas)?

**Por qué importa:** ...769 ya no la usa nada activo (borrarla no rompe nada). ...906 la usan gbrain config, content-machine y el tenant cortex pancho-test: borrarla antes de reemplazarla los deja sin OpenRouter.

**Cómo:** responde en el chat, por ejemplo "a sí, b después, c es de X". El navegador interno de Claude no tiene sesión en OpenRouter: inicia sesión tú en https://openrouter.ai/settings/keys dentro del navegador de Claude y avísame, o bórralas tú mismo. Llaves nuevas: una para gbrain con tope USD 10/mes y otra para content-machine con tope USD 5/mes.

**Detalle:** `C:\DEV\Pancho-OS\docs\audits\2026-09-28-openrouter-hermes-remediacion.md`

## 1. Hermes completo en el OS: publicar el enlace del menú (28-sep-2026)

**Qué decidir:** ¿fusiono el PR de la Fase 1 a master? Sí o no.

**Por qué importa:** el servicio ya corre en el VPS (solo Tailscale), pero el enlace "Hermes completo" en el menú del OS (`/hermes/app`) aparece en producción solo al fusionar, porque cada push a master se despliega solo.

**Cómo responder:** "fusiona" o "todavía no". El enlace del PR está en el reporte del chat y en la rama `feat/hermes-ui-fase1`.

**Contexto:** resultado completo en [plan-hermes-en-os.md, sección Resultado Fase 1](C:\DEV\Pancho-OS\docs\plan-hermes-en-os.md) (`C:\DEV\Pancho-OS\docs\plan-hermes-en-os.md`). Mientras tanto ya puedes abrirlo directo: http://100.127.42.51:9120 (con Tailscale encendido).

Resueltas el 28-sep-2026: Fase 1 aprobada ("si haz fase 1"); acceso = **A, solo Tailscale** (tomada por defecto, la recomendada; si prefieres B, dilo).

## 1b. Hermes completo dentro del OS, sin pestaña aparte (28-sep-2026)

**Qué decidir:** ¿activas HTTPS en tu cuenta de Tailscale? Sí o no.

**Por qué importa:** hoy "Hermes completo" se abre en una pestaña nueva, porque una página https (el OS) no puede mostrar dentro una http. Con HTTPS en Tailscale, lo muestro incrustado dentro del OS y sigue siendo solo Tailscale.

**Cómo:** 2 minutos. En https://login.tailscale.com/admin/dns, baja a "HTTPS Certificates" y pulsa "Enable HTTPS". Después me avisas y yo hago el resto en el VPS.

## 2. Chat de Hermes para clientes de Nerio (28-sep-2026)

**Qué decidir:** ¿los clientes de Nerio necesitan ver y chatear con su agente desde una web? Sí o no.

**Por qué importa:** `C:\DEV\nerio-agent` es el perfil del agente (personalidad, skills, alta de clientes); no tiene interfaz. La interfaz para clientes iría en nerio-app. El panel de Hermes no sirve para clientes porque muestra configuración, claves y terminal.

**Cómo responder:** "sí, chat para clientes" o "no por ahora".
