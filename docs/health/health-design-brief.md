# Pancho OS · brief visual de Salud

Fuente: 42 capturas entregadas en `docs/health/` (25 de agosto de 2026), revisadas una por una y agrupadas por las familias visuales que aparecen en el material. El objetivo no es copiar marcas externas, sino traducir sus patrones a Pancho OS.

## Dirección visual común

- Mobile-first, oscuro y de alto contraste. Fondo casi negro, superficies carbón, tipografía grande y una acción primaria evidente.
- La pantalla debe responder primero a “qué hago ahora”: una tarjeta principal, un CTA grande y navegación inferior simple.
- Las tarjetas usan color como significado: azul para acción/registro, verde para recuperación o ayuno, violeta para sueño, turquesa para pasos/cardio y ámbar para movilidad.
- Las imágenes circulares de ejercicios funcionan como reconocimiento rápido; en Pancho OS deben ser assets locales o iconos propios, nunca dependencias remotas frágiles.
- Cada flujo conserva estado visible: duración, progreso, siguiente ejercicio, serie actual, ventana de ayuno o sincronización.

## Familia 1 · Fuerza y rutinas

Las capturas de las 17 imágenes de las 10:17 muestran una rutina planificada tipo push/pull/legs: encabezado de día, duración estimada, número de ejercicios, miniatura circular, series/repeticiones y botón “Start Workout”.

Pantallas que necesita Pancho OS:

1. **Rutina de hoy**: nombre del día, duración estimada, cantidad de ejercicios y progreso.
2. **Lista de ejercicios**: miniatura, nombre, series, repeticiones, peso objetivo y estado completado.
3. **Detalle de serie**: ejercicio actual, descanso, peso/reps, contador y “siguiente”.
4. **Resumen**: volumen, duración, ejercicios completados y nota de sesión.
5. **Biblioteca**: buscar por ejercicio/área y agregar a una rutina.

Datos mínimos: `rutinas`, días/orden, ejercicios, series, `sesiones_gfit`, `sesion_series`, peso, repeticiones, duración y notas. No se debe mostrar una rutina como “activa” si sólo fue consultada explícitamente.

## Familia 2 · Movilidad y estiramiento

Las capturas de las 13 imágenes de las 10:22 muestran rutinas cortas de 5, 15 y 30 minutos, agrupadas por objetivo (despierta, cuerpo completo, sueño), con ilustraciones circulares y un botón de inicio.

Pantallas que necesita Pancho OS:

1. **Selector de rutina**: duración, objetivo, dificultad y número de movimientos.
2. **Rutina guiada**: movimiento actual, ilustración, temporizador, instrucciones cortas y “siguiente”.
3. **Lista editable**: duración por movimiento, quitar/reordenar y compartir/guardar.
4. **Cierre**: minutos completados, sensación/energía y recomendación de repetición.

La rutina “Despierta” debe ser una entrada AM de 5 minutos; “Cuerpo completo” una opción de 15 minutos; “Sueño” una opción nocturna de baja intensidad. El sistema no debe convertirlas automáticamente en entrenamiento de fuerza.

## Familia 3 · Ayuno, hidratación y peso

Las 11 imágenes de las 10:21 muestran un hub con tres tarjetas: hidratación, fasting y peso; un selector de última comida; presets 14:10, 16:8 y 18:6; y una navegación inferior dedicada.

Pantallas que necesita Pancho OS:

1. **Hub de salud diaria**: ayuno actual, agua, peso y CTA de registro.
2. **Elegir ventana**: presets 14:10, 16:8, 18:6 y opción personalizada.
3. **Iniciar ayuno**: hora de última comida, hora prevista de apertura y confirmación.
4. **Ayuno activo**: contador, progreso, hidratación y terminar/ajustar.
5. **Historial**: ayunos completados, duración real y cumplimiento semanal.

Los datos de peso deben quedar separados de sueño y biometrías no disponibles. Nunca se debe inventar `peso_kg` cuando no existe una lectura real.

## Familia 4 · Dashboard de salud

La captura de dashboard muestra tarjetas grandes de pasos, readiness, sueño y cardio semanal, un botón de registro/inicio y estados de sincronización.

Pancho OS necesita:

- Una tarjeta de sueño que elija la última fila con `sueno_min` no nulo.
- Indicador de fuente y hora de última sincronización.
- Estados explícitos: sin datos, sincronizando, datos parciales y error.
- Acciones rápidas: registrar comida, iniciar ayuno, registrar peso, iniciar rutina y abrir estiramiento.
- Vista semanal con tendencia, no sólo el valor del día.

## Mapa de implementación por fases

- **Fase L**: Android Health Connect para sueño, pasos, peso y sesiones, con permisos explícitos y POST a `/api/biometricas`.
- **Fase M**: usar este brief para rediseñar estiramiento, fuerza/rutinas, ayuno y dashboard; no requiere todavía Health Connect.
- **Fase N**: conectar hábitos, streaks, cartas y nudges a los estados reales de sueño, movimiento, ayuno y comida.

## No hacer todavía

- No copiar branding, ilustraciones o textos de Jefit/otras apps.
- No activar recomendaciones médicas ni metas de peso automáticas.
- No bloquear el dashboard por falta de sincronización.
- No introducir una segunda fuente de verdad para rutinas o biometrías.
