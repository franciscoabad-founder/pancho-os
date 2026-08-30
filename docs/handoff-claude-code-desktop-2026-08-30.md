# Handoff para Claude Code: Pancho OS Desktop

Fecha: 2026-08-30
Autor: ChatGPT
Rama: `master`
Repositorio: `franciscoabad-founder/pancho-os`

## Estado verificado

- `master` está limpia y sincronizada. Último commit: `6235181 fix: ofrecer activacion de salud en segundo plano`.
- Producción activa: `https://os.franciscoabad.com`, servicio `pancho-os-next` en el VPS `178.105.163.120`.
- Producción usa Postgres propio dentro de `pancho-os-postgres`, bases `pancho_os` y `pancho_os_staging`. Supabase Cloud está deprecado y no es fuente de verdad.
- Las grabaciones ya usan disco local y URLs firmadas HMAC. No queda una dependencia runtime activa de Supabase Storage; solo quedan comentarios históricos que pueden limpiarse con cuidado.
- La app web es la fuente visual y funcional. El APK Android la carga en WebView y añade capacidades nativas.
- Android versión verificada: `1.0.13`. Artifact: `Android/artifacts/build-33337408603/app-release.apk`.
- Health Connect funciona en el dispositivo usado para QA. Se concedieron `READ_STEPS`, `READ_SLEEP`, `READ_WEIGHT` y `READ_HEALTH_DATA_IN_BACKGROUND`. El worker de salud queda programado cada 6 horas con red disponible.
- Cámara y micrófono se solicitan bajo demanda. No se piden permisos permanentes innecesarios.
- CI GitHub está verde para deploy y APK, incluidos los runs `33337408852` y `33337408603`.
- Suite de pruebas de dominio, API, auth, agenda, contenido, radar, sueño, hábitos, finanzas, journal, brain-write y build pasó. `npm test` no existe como script genérico.

## Qué debe hacer Claude Code

El objetivo de este handoff es cerrar la app desktop, no rehacer el web OS ni el APK.

1. Leer `AGENTS.md`, `CLAUDE.md`, este handoff y `src-tauri/tauri.conf.json`.
2. Auditar la implementación existente de Tauri en `src-tauri/` y el bridge `src/lib/desktopBridge.ts`.
3. Ejecutar la app desktop en modo silencioso y comprobar que abre exactamente la misma experiencia que `https://os.franciscoabad.com`, respetando auth, rutas, refresh, enlaces externos y errores de red.
4. Completar cualquier integración nativa ya iniciada en Rust (`flow`, `hermes`, `ollama`, `terminal`, `fs`) solo si está conectada al producto y tiene un caso de uso claro. No inventar funciones nuevas.
5. Revisar permisos, capabilities, CSP, iconos, nombre de producto, instalador Windows y actualización segura. No incluir secretos ni `.env`.
6. Añadir o corregir pruebas reproducibles para el bridge y el empaquetado desktop. Si el build local falla por el entorno, dejar evidencia y validar mediante CI.
7. Probar la navegación principal: inicio, agenda, salud, tareas, bandeja, notas, chat y captura. Confirmar que el desktop no diverge visualmente del web OS.
8. Actualizar documentación de instalación y troubleshooting.
9. Commit convencional y push directo a `master`. No crear ramas paralelas ni dejar cambios sin commit.

## Restricciones

- No aplicar migraciones en Supabase Cloud.
- Si una migración fuese estrictamente necesaria, aplicar el procedimiento del `AGENTS.md` en las dos bases del VPS.
- No tocar secretos del VPS ni subir credenciales.
- No usar terminales o ventanas visibles durante QA.
- No sustituir la UI web por una UI desktop paralela. Desktop debe ser el OS, con capacidades nativas encima.

## Criterio de terminado

Desktop abre, autentica y navega el OS real; el bridge nativo funciona o queda explícitamente documentado; el instalador se genera; las pruebas pasan; CI queda verde; `master` queda limpia; y el resultado se registra en GBrain con autor Claude Code.

## Pendientes no bloqueantes conocidos

- Confirmar una sincronización automática de Health Connect después del siguiente intervalo de 6 horas.
- Hacer una prueba física de cámara desde el APK.
- Revisar warnings de Node 20 en GitHub Actions.
- Investigar el fallo de loopback de Gradle local, aunque CI ya compila.
