# Auditoría de crons Hermes y n8n

Fecha: 9 de agosto de 2026

## Estado inmediato

- `Netlife response monitor` fue eliminado por decisión de Pancho.
- `PanchoAtlas análisis semanal de redes` fue pausado por decisión de Pancho.
- `Daily Inbox Briefing` fue pausado temporalmente: tenía un pin heredado a Gemini. Cambiar solo su modelo a `gemma4:e2b-it-qat` no conecta el cron al endpoint de Ollama del HomeLab. Debe reconfigurarse con proveedor y `base_url` locales antes de reactivarlo.
- `Hermes updates check` sigue activo. Es un script local sin modelo ni consumo de tokens.
- `Recordatorio pricing Taskr` es un cron vencido, sin próxima ejecución. Debe eliminarse en la consolidación.

## Crons Hermes descubiertos

| Cron | Estado | Frecuencia | Modelo actual | Evaluación |
|---|---|---|---|---|
| Daily Inbox Briefing | Pausado | Diario, `0 13 * * *` UTC | Gemma4 solicitada, pin de proveedor heredado incorrecto | Mantener, pero modernizar y conectar explícitamente a Ollama HomeLab. |
| Recordatorio pricing Taskr | Vencido | Una vez, 2 de julio de 2026 | No aplica | Eliminar. |
| Hermes updates check | Activo | Lunes, `0 12 * * 1` UTC | No aplica | Mantener. Verifica actualizaciones sin usar un agente. |
| PanchoAtlas análisis semanal de redes | Pausado | Lunes, `0 0 * * 1` UTC | Grok 4.20 | Rediseñar antes de reactivar: no debe inventar métricas si el OS no las entrega. |
| PanchoAtlas minería de contenido | Activo | Cada 3 días, `0 23 */3 * *` UTC | Grok 4.20 | Pausar y rediseñar junto con el análisis de redes. |

## Qué hacen hoy

### Daily Inbox Briefing

Lee Gmail de las últimas 48 horas, marca acciones, informativos y ruido. Archiva newsletters y promociones. También revisa un hilo histórico de Netlife y una página antigua de pendientes JTBD.

Mejora propuesta:

1. Quitar Netlife y la página JTBD con fecha fija.
2. Leer solo datos operativos actuales: bandeja, agenda y tareas del OS.
3. No archivar correos automáticamente hasta que la política de correo y el registro de decisiones estén conectados al OS.
4. Ejecutarlo con Gemma4 en HomeLab mediante una conexión explícita a Ollama.

### Análisis semanal de redes

Lee canon de marca y reportes previos de GBrain. Produce tres hallazgos, dos decisiones y tres acciones. El último reporte está en `[[panchoatlas-analisis-redes-semanal-2026-08-09]]`.

Hallazgo de auditoría: el reporte identifica correctamente que no tiene métricas reales del OS, pero aun así recomienda decisiones de publicación. No debe presentarlas como datos medidos.

Mejora propuesta:

1. Exigir fuente y fecha para toda métrica.
2. Si no existe métrica, entregar diagnóstico cualitativo marcado como hipótesis.
3. Crear propuestas en OS como borradores, nunca tareas automáticas.
4. Usar Grok para estrategia social solo cuando haya datos o investigación externa verificable.

### Minería de contenido

Lee el canon de marca y páginas recientes de GBrain para producir seis sugerencias de contenido. El último reporte está en `[[panchoatlas-mineria-contenido-2026-08-09]]`.

Hallazgo de auditoría: una sugerencia propuso el gancho `+12% engagement` aunque el reporte de redes dice que no hay métricas disponibles. Es una afirmación no verificada y no debe llegar a un borrador público.

Mejora propuesta:

1. Separar ideas, afirmaciones verificadas y evidencia requerida.
2. Prohibir números, resultados y casos de éxito sin una fuente concreta.
3. Guardar cada idea como borrador de contenido en OS, con enlaces de provenance en GBrain.
4. Mantener la aprobación obligatoria antes de publicar.

## Crons n8n encontrados

Todos los crons ajenos a Arazzá estaban apagados al momento de esta auditoría. Se deben reconstruir en Hermes por intención operativa, no copiar uno por uno:

- Briefing matutino de cerebro a Telegram.
- Revisión semanal del OS.
- Despacho de recordatorios del OS.
- Espejo de tareas hacia Google Tasks.
- Minería de contenido semanal y cada tres días.
- Digest nocturno de notas.
- Sincronización y análisis de redes.
- Ejecutor de aprobaciones Cortex.
- Briefing diario Cortex.
- Coach diario de salud.
- Backfill del Banco de Ideas.
- Curador semanal de GBrain.

Arazzá conserva en n8n su cron activo `Ara - Relojes horarios (ventana 24h + followups)` cada hora, más sus webhooks y puente hacia Hermes.

## Reportes localizados en GBrain

- `[[panchoatlas-analisis-redes-semanal-2026-08-09]]`
- `[[redes-analisis-2026-08-02]]`
- `[[redes-analisis-2026-07-26]]`
- `[[panchoatlas-mineria-contenido-2026-08-09]]`
- `[[contenido-sugerencias-2026-08-06]]`
- `[[contenido-sugerencias-2026-08-03]]`
- `[[contenido-sugerencias-2026-07-16]]`

El siguiente paso es una migración con un solo calendario Hermes, una bitácora de ejecuciones en OS y fuentes verificables para contenido y redes.
