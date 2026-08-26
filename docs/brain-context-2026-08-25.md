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

Fase D ya tiene implementación local: `os_kpis.objetivo_id` opcional con FK a `os_objetivos` (`supabase/migrations/20260826000001_kpis_objetivos.sql`), selector de objetivo al crear KPI, objetivo visible en KPIs, avance visible en Hoy y selección de objetivos/KPIs relacionados en el check-in trimestral. La migración aún debe aplicarse en Supabase antes de desplegar.

Codex amplió `os_revisiones` para aceptar `anual` y `trimestral`, y añadió formularios de ocho dominios y check-in OKR en Week Review. Se reutiliza el JSONB existente, sin tabla paralela. El legacy Astro también acepta los nuevos tipos.

La conexión O↔D está implementada y validada: el trimestral persiste `objetivoIds`, muestra KPIs asociados y filtra IDs inexistentes en el guardado del cliente. Se corrigió un riesgo de sobrescritura: si falla la lectura anual/trimestral, la pantalla ya no permite guardar formularios vacíos. Build y tests existentes pasan; falta aplicar la migración en Supabase y hacer commit selectivo de D/O.

## Roadmap pendiente

1. B: aprobaciones como notificación en topbar, decisión con timestamp, expiración y respuesta desde Telegram.
2. C: triage conversacional de Bandeja/Notas/Pendientes/Recordatorios y deadline/prioridad.
3. D: KPIs relacionados con objetivos (implementado localmente; migración pendiente de aplicar y commit).
4. E: Journal con sync automático a Brain, mood y sugerencias de tareas/personas.
5. F–G: Google Calendar two-way sync y timeblocking real.
6. H: iteración de Ikigai con Hermes.
7. I: wizard de Networking basado en PDFs reales de +Acumen.
8. J–K: dashboard por proyecto y Finanzas agentica.
9. L–M: Health Connect Android y brief visual de 42 pantallas.
10. N: nudges/journeys RPG basados en el research, después de decidir dramatización y colateral.
11. P: scaffolding de integraciones de redes y métricas.
12. Q: grafo de interconexión entre Journal, Networking, proyectos y tareas.

Contenido (Radar/Planner) y Hermes Cockpit ya no deben tratarse como trabajo pendiente de branches antiguas: verificar siempre `git log` y las rutas TanStack actuales antes de portar algo.

## Reglas de continuidad

- No borrar cambios ajenos del working tree.
- Aplicar migraciones SQL manualmente en Supabase cuando el entorno no tenga acceso directo.
- Usar `src/server/osAuth.ts` y `src/server/supabase.ts` en rutas TanStack.
- Las rutas dinámicas TanStack usan `$id.ts`, no `[id].ts`.
- Cada fase requiere build, tests relevantes y tres revisiones independientes PASS antes de commitear.
- No afirmar que una integración externa funciona sin verificarla con datos reales.
