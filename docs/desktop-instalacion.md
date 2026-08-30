# Pancho OS Desktop: instalación y troubleshooting

Actualizado 30 ago 2026. La app de escritorio (Tauri 2, `src-tauri/`) es un
shell nativo sobre el OS real (`https://os.franciscoabad.com`). No es una UI
paralela: carga la misma app web de producción y añade capacidades nativas
(bandeja del sistema, autostart, notificaciones, y el bridge de
`src/lib/desktopBridge.ts` hacia Flow, Hermes, Ollama, fs y terminal).

## Requisitos de build (Windows)

- Rust estable (`rustup`), probado con cargo 1.98.
- Node 22+ (el repo usa `--experimental-strip-types`).
- WebView2 Runtime (viene con Windows 11; el instalador NSIS lo bootstrapea si falta).

## Comandos

```bash
npm install
npm run tauri dev        # desarrollo: abre la ventana contra el OS de produccion
npm run tauri build      # genera instaladores en src-tauri/target/release/bundle/
npm run test:desktop     # pruebas del bridge (Node puro, sin Tauri)
```

El build de Windows produce `bundle/msi/*.msi` (WiX) y `bundle/nsis/*-setup.exe`
(NSIS). Cualquiera de los dos instala la app; NSIS es el recomendado para
usuario final porque bootstrapea WebView2.

## Decisiones de diseño (leer antes de "arreglar" algo)

- **La ventana se crea por código en `src-tauri/src/lib.rs`, no en
  `tauri.conf.json`** (por eso `app.windows` está vacío en el config). Es la
  única forma de interceptar la navegación: los dominios del OS
  (`os.franciscoabad.com` y su alias `next.os.franciscoabad.com`) navegan
  dentro de la app; cualquier otro enlace se abre en el navegador del sistema
  vía `tauri-plugin-opener`. No volver a declarar la ventana en el config: se
  pierde ese interceptor.
- **CSP es `null` a propósito.** El contenido es 100% remoto; el CSP que
  aplica es el que sirve el servidor web del OS, no el del shell. Un CSP local
  aquí solo afectaría páginas locales, que no existen.
- **Auth**: el OS usa su cookie de sesión propia. WebView2 la persiste en el
  data dir de la app (`%LOCALAPPDATA%/com.franciscoabad.panchoos`), así que el
  login sobrevive reinicios. No hay código de auth en el shell.
- **El bridge nativo (`desktopBridge.ts`) todavía no tiene consumidores en la
  UI.** Los comandos Rust (flow, hermes, ollama, fs, terminal) están
  implementados y probados por contrato, pero ninguna pantalla los invoca aún.
  En navegador `isDesktop()` es false y todo devuelve `sin_escritorio`: cero
  regresión web garantizada por `npm run test:desktop`.
- **Hermes requiere configuración manual de token** (ver cabecera de
  `src-tauri/src/hermes.rs`). Hasta entonces `hermesA2ACall` devuelve
  `hermes_sin_token` con instrucciones. Es el estado esperado, no un bug.

## Troubleshooting

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Ventana en blanco al abrir | Sin red, o el OS caído | Verificar `https://os.franciscoabad.com` en un navegador; la app no cachea offline |
| Pide login otra vez | Cookie expirada o data dir borrado | Loguearse de nuevo; la sesión persiste en `%LOCALAPPDATA%/com.franciscoabad.panchoos` |
| Un enlace externo no abre nada | Falla del opener | Revisar log en modo dev (`npm run tauri dev` imprime a consola) |
| Segundo doble-click no abre otra ventana | Comportamiento esperado | `single-instance` enfoca la ventana existente |
| La app "no cierra" | Quedó en la bandeja del sistema | Click derecho en el icono de bandeja, "Salir" |
| `npm run tauri build` falla con error de WiX/NSIS | Toolchain de bundling ausente | Tauri lo descarga solo al primer build; requiere red. Reintentar |
| Build local imposible por entorno | — | CI valida el build; dejar evidencia del error local en el commit |

## Qué NO hacer

- No aplicar migraciones en Supabase Cloud (ver `AGENTS.md`).
- No apuntar la ventana a `localhost` ni a un build local del frontend: desktop
  debe ser el OS de producción.
- No agregar permisos a `capabilities/default.json` sin necesidad: los comandos
  propios del app no requieren ACL; solo plugins core (hoy: core, autostart,
  notification).
