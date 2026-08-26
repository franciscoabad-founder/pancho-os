# Pancho OS · estado consolidado y handoff

Fecha de consolidación: 2026-08-25. Este documento reúne el estado de las sesiones Claude, Antigravity y Codex para que el trabajo no dependa de una sesión temporal.

## Estado confirmado del repositorio

- Rama activa: `hermes-cockpit`.
- `6d58bde` contiene la Fase A: quick wins, navegación compartida de Contenido, campos CRM, proyectos en CRM/Tareas, edición inline de Finanzas, archivado de recordatorios, tile de sueño, Ikigai y hábitos base.
- `a824ccf` contiene Hermes Cockpit: ruta `/hermes`, perfiles VPS/HomeLab/Laptop, selector de modelos, sesiones de Telegram y OS, dictado Web Speech API, kanban operativo y navegación.
- El build de producción pasó después de integrar el cockpit.
- Hay cambios ajenos todavía sin commitear en Taski, Sistema/Week Review, Android, screenshots, `.claude` y QA. No deben borrarse ni mezclarse con fases nuevas sin revisar su propietario.

## Hermes Cockpit y Taski

Taski acepta `session_id`, lista sesiones de Telegram y permite elegir una conversación. El proxy conserva `pancho-os` como sesión por defecto. El endpoint real de sesiones no contiene los topics esperados de PanchoHQ, pero sí sesiones DM de Xaxxo. No se deben inventar sesiones ni afirmar que perfiles HomeLab/Laptop ejecutan operaciones hasta conectar transportes reales.

Hallazgos pendientes del cockpit: perfil seleccionado todavía no cambia el nodo de ejecución, el hook de voz puede abortar al cambiar callbacks, hay duplicación entre `OSHermesCockpit` y `TaskiBubble`, y el estado HomeLab se marca online sin health check real.

## Research incorporado

### Revisión anual y trimestral

La revisión anual combina YearCompass, auditoría 80/20, estados deseados y visión anual. Recorre ocho dominios: vida/familia, carrera/estudios, amigos/comunidad, ocio/creatividad, salud física, salud mental, hábitos definitorios y contribución/impacto. El cierre convierte la visión en tres prioridades.

El check-in trimestral dura 15–20 minutos y registra objetivos OKR de 90 días, Lag KPIs (resultado), Lead KPIs (proceso), tasa de ejecución, energía, aprendizajes y ajustes. La revisión semanal mantiene el bucle de ejecución.

### Hábitos, Fabulous y 4/4/4

El research recomienda journeys graduales, microacciones ancladas, cartas diarias curadas, intención de implementación y feedback inmediato. El tono de recuperación debe ser firme pero no culpabilizante. El diseño RPG puede usar nudges escalados, pero las penalizaciones económicas/HP y el bloqueo del dashboard requieren una decisión explícita de producto antes de activarse.

Hormozi separa la forma del día (Maker/Manager, bloques protegidos) de la función estratégica (Build/Promote/Deliver/Sell). La distribución se debe medir semanalmente, no imponer como tres cuotas rígidas cada día. La conversación sobre Maker/Manager/Seller/Builder sigue abierta.

## Fase D y O en curso (actualizado por Codex)

Fase D ya tiene implementación local: `os_kpis.objetivo_id` opcional con FK a `os_objetivos` (`supabase/migrations/20260826000001_kpis_objetivos.sql`), selector de objetivo al crear KPI, objetivo visible en KPIs, avance visible en Hoy y selección de objetivos/KPIs relacionados en el check-in trimestral. La migración fue aplicada y verificada en Supabase `yfrrfmankgodpepbgyvu` (columna UUID nullable presente).

Codex amplió `os_revisiones` para aceptar `anual` y `trimestral`, y añadió formularios de ocho dominios y check-in OKR en Week Review. Se reutiliza el JSONB existente, sin tabla paralela. El legacy Astro también acepta los nuevos tipos.

La conexión O↔D está implementada y validada: el trimestral persiste `objetivoIds`, muestra KPIs asociados y filtra IDs inexistentes en el guardado del cliente. Se corrigió un riesgo de sobrescritura: si falla la lectura anual/trimestral, la pantalla ya no permite guardar formularios vacíos. Build y tests existentes pasan; D/O está commiteada en `dbba247`.

## Fases E, F y J completadas (commit `527f9a8`)

- E Journal: `/api/journal` guarda mood, sincroniza POST y PATCH con Brain de forma degradable, y devuelve sugerencias explícitas de tareas/personas sin ejecutar acciones automáticamente. Tests dedicados: 14/14.
- F Agenda: `/api/agenda/sync` protegido con OAuth refresh-token opcional, importación y exportación opt-in, cancelaciones remotas y fechas RFC3339. La UI muestra el botón Google Calendar y devuelve 503 claro si faltan `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` o `GOOGLE_CALENDAR_REFRESH_TOKEN`. La sincronización real queda pendiente de completar OAuth; no se deben inventar credenciales.
- J Proyectos: el detalle filtra KPIs, gastos, por cobrar, por pagar, tareas y pendientes por proyecto. Brain es contexto opcional; fallos parciales de APIs se muestran como aviso. Cobros/pagos se agregan por moneda. Supabase tiene links `proyecto` e índices para `gastos`, `por_cobrar` y `por_pagar`; se creó la tabla `por_pagar` en producción porque no existía.
- Gate triple E/F/J: PASS. `npm run test:journal`, `npm run test:auth` (154/154) y `npm run build` pasan. Observación menor: Google limita la consulta a 2500 eventos y todavía no pagina `nextPageToken`.

## Fases G, H e I completadas (commits `e25eb88`, `9844f49`)

- G Semana: motor puro de timeblocking y `GET /api/semana/timeblocks` protegido. Calcula huecos reales a partir de reuniones, modo Maker/Manager/Off y presupuesto por función; Semana los muestra como sugerencias read-only. No persiste automáticamente.
- H Ikigai: `POST /api/ikigai/iterar` envía a Hermes un contexto acotado y no destructivo; la UI deja claro que las sugerencias no mutan el mapa. Requiere `TASKI_TOKEN` y perfil allowlisted.
- I Networking: wizard guiado en `/red` basado en los materiales recuperables de +Acumen (diagnóstico, scorecard y plan). Reutiliza `/api/red`; generación de tareas requiere acción explícita. Se aplica máximo de 16 personas activas. El PDF principal `Francisco_Abad_Networking_Leadership_101-_Building_Your_Core_Professional_Network.pdf` está truncado/corrupto en OneDrive y no se usó como fuente.
- Gates G/H/I: PASS con observaciones menores no bloqueantes (timeblocking no acepta automáticamente; límite de 16 no es transaccional ante altas simultáneas; Google aún pagina sólo 2500 eventos).

## Roadmap pendiente

1. B: aprobaciones como notificación en topbar, decisión con timestamp, expiración y respuesta desde Telegram.
2. C: triage conversacional de Bandeja/Notas/Pendientes/Recordatorios y deadline/prioridad.
3. D: KPIs relacionados con objetivos (implementado, migrado y commiteado en `dbba247`).
4. K: implementada primera capa agéntica. `/api/finanzas/asesor` detecta cobros vencidos, pagos próximos y cobertura de liquidez; solo crea propuestas en `os_aprobaciones` tras acción explícita, nunca mueve dinero ni cambia estados financieros. Probada y desplegada en `d82104b`.
9. M: implementada la primera vertical visual de salud (dashboard y estiramiento) con hero contextual, KPI cards responsive, estados de error, rutinas vacías seguras, accesibilidad del cronómetro y reduced-motion. Brief visual en `docs/health/health-design-brief.md`; PR #5 mergeada en `master` (`f07051e`).
10. L: Health Connect Android.
11. N: implementado nudge contextual en Hábitos a partir de `/api/habitos/brief`: siguiente acción, progreso del journey y tono de reinicio amable. No envía notificaciones ni aplica penalizaciones automáticas.
12. P: scaffolding de integraciones de redes y métricas.
13. Q: implementada la primera vista `/conexiones`, de solo lectura. Une proyectos con tareas y Journal por el campo estructurado `proyecto`, y planes de Networking con personas por objetivos de red; no infiere relaciones desde texto libre. Queda pendiente una visualización interactiva si aporta más que la vista operacional actual.

## Producción: credenciales Supabase (actualizado por Codex)

El VPS tenía una service role legacy y el proceso activo (`pancho-os-next`) atendía el dominio. Se migró a secret key moderna y se ajustó `src/server/supabase.ts` para enviar claves opacas `sb_secret_...` exclusivamente como header `apikey`, no como `Authorization: Bearer`. `GET /api/kpis`, `/api/finanzas/asesor` y `/api/conexiones` respondieron 200 localmente en el proceso activo después del deploy de `d82104b`.

Contenido (Radar/Planner) y Hermes Cockpit ya no deben tratarse como trabajo pendiente de branches antiguas: verificar siempre `git log` y las rutas TanStack actuales antes de portar algo.

## Reglas de continuidad

- No borrar cambios ajenos del working tree.
- Aplicar migraciones SQL manualmente en Supabase cuando el entorno no tenga acceso directo.
- Usar `src/server/osAuth.ts` y `src/server/supabase.ts` en rutas TanStack.
- Las rutas dinámicas TanStack usan `$id.ts`, no `[id].ts`.
- Cada fase requiere build, tests relevantes y tres revisiones independientes PASS antes de commitear.
- No afirmar que una integración externa funciona sin verificarla con datos reales.
