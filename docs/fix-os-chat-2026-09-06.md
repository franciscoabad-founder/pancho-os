# Fix del chat del OS: modelos, sesiones y perfiles (6 sep 2026)

Rama: `fix/os-chat-sesiones-modelos-2026-09-06` (3 commits, sin merge, sin push, sin deploy).
Base: la auditoria `docs/auditoria-setup-hermes-os-2026-09-06.html`, secciones a, b, e, f, g, i.

## Resumen de lo que decia la auditoria

- **(a) Perfiles**: `homelab-local` y `laptop-local` tenian `activo:false` escrito a mano
  en `taski.handlers.ts` y puerto `9120` hardcodeado. 9120 es `hermes serve` (backend del
  Desktop), no el `api_server`, que siempre es 8642.
- **(b) Sesiones raras**: los titulos los inventa el auto-titulador de Hermes
  (`agent/title_generator.py`, cuyo prompt trae `{"title": "Friendly greeting"}` como
  ejemplo literal). El `(83)` es `message_count`, mensajes acumulados incluyendo turnos de
  herramientas, no no-leidos. Las conversaciones de `/chat` (`os-chat-*`) no salian porque
  el proxy filtraba `source=telegram`.
- **(e) Burbuja TASKI**: el selector de sesion ya existia, pero solo veia Telegram, sin
  perfil y sin poder crear sesiones.
- **(f) Modelo**: el OS leia `GET /v1/models`, que anuncia un modelo virtual
  (`hermes-agent`) mas alias de `model_routes`. El catalogo real es `GET /api/model/options`.
  El fallback a `POST /api/model` no existe en el api_server.
- **(g) Nombres**: el backend ya soporta titulo al crear y `last_active` por sesion; el
  frontend simplemente los ignoraba.
- **(i) Chat propio**: decision de paralelo (Telegram sigue siendo el canal humano), con
  pendiente de unificar el selector de sesiones entre las tres listas.

## Que se arreglo

### 1. Dropdown de Modelo real (prioridad 1) — hecho

`listarModelosHermes()` ahora intenta, en orden:

1. `GET /api/model/options` — el inventario real de proveedores del gateway, el mismo que
   usan el dashboard y el TUI de Hermes. Devuelve
   `{providers: [{slug, name, models: [...], authenticated, warning}], model, provider}`
   (ver `hermes_cli/inventory.py:335`, `build_model_options_payload`). Se aplana a
   `proveedor/modelo`.
2. `GET /v1/models` — el alias compatible con OpenAI, solo si trae algo distinto de
   `hermes-agent`.
3. `MODELOS_DEFAULT` — set de referencia del OS.

La respuesta de `/api/taski/modelos` incluye `fuente` (`options` | `v1-models` | `fallback`)
y `aviso`. La UI (cockpit y burbuja) pinta el `aviso` en texto chico ambar cuando la fuente
no es la buena, en vez de fingir que el catalogo esta completo.

- **Modelo activo**: sale del campo `model` de `GET /api/sessions/{id}` (esta en
  `_session_response`, `api_server.py:4286`), no del string fijo `modeloPrincipal`. Si la
  sesion tiene bloqueado un modelo que no esta en el catalogo, se muestra igual con la
  marca `(activo)`.
- **Cambio por sesion**: `POST /api/sessions/{id}/model` con `{model, provider}`. Se elimino
  el fallback a `POST /api/model`, que no existe y solo convertia un error claro en un 404
  confuso. Un fallo revierte el selector y muestra el mensaje real de Hermes.
- **Recarga**: cambiar de sesion recarga el modelo, porque el lock es por sesion.

### 2. Nombres de sesion con sentido (prioridad 1) — hecho

- Formato unico en `src/os/lib/sesiones.ts`: `Nombre · dd/mm HH:mm` con la fecha de ultima
  actividad. Usado por las tres listas (`/chat`, burbuja, cockpit).
- El conteo de mensajes va en un chip aparte con tooltip que aclara que son mensajes
  acumulados, no sin leer. Ya no va pegado al titulo.
- **Renombrar**: input inline con Enter/Escape en el cockpit y en `/chat`.
  - Sesiones de Hermes: `PATCH /api/taski/sesiones` → intenta
    `PATCH /api/sessions/{id} {"title": "..."}` (existe en el api_server:
    `_handle_patch_session`, campo permitido `title`) y **siempre** guarda el alias en la
    tabla nueva `chat_sesiones_alias` del OS.
  - Conversaciones del OS: `PATCH /api/chat/:id`, que actualiza `chat_conversaciones.titulo`
    y replica a la sesion de Hermes.
  - El alias local se muestra **por encima** del titulo de Hermes, asi el nombre sobrevive
    aunque la build del VPS no tenga el PATCH y aunque el auto-titulador vuelva a correr.
    No hizo falta bandera `titulo_manual`: el auto-titulado solo pisa el literal
    `'Nueva conversacion'`.
- **Migracion**: `supabase/migrations/20260906000100_sesiones_alias.sql`, aditiva e
  idempotente. Si no se aplica, renombrar degrada a "solo Hermes" y nada revienta
  (`mapaAlias()` devuelve un mapa vacio ante error de tabla).

### 3. Perfiles Laptop y HomeLab (prioridad 2) — hecho del lado del OS

La causa era codigo, no health check: `activo: false` estaba **escrito a mano** para los dos
perfiles no-VPS. El `online` ya se calculaba de verdad, pero `activo` nunca se usaba en la
UI y el punto gris venia de `online`.

- `activo` ahora se deriva de `online` (health check real: `GET /api/sessions?limit=1`).
- Puerto corregido a **8642** en los tres perfiles.
- Indicador: verde con glow cuando responde, gris cuando no.
- Boton deshabilitado con tooltip que distingue los dos casos:
  - sin `TASKI_BASE_*` / `TASKI_TOKEN_*` en el `.env` → "Falta configurarlo en el .env del OS"
  - configurado pero sin respuesta → "no responde el health check, revisa que este encendido,
    en la tailnet y con api_server en 8642"
- Etiqueta de la laptop corregida a `Laptop (Tailscale 100.106.81.110)` (decia `127.0.0.1`).

Para que se pongan verdes hace falta trabajo **fuera de este repo**: ver "Pendiente".

### 4. Widget flotante TASKI: selector de sesion (prioridad 2) — hecho, con matiz

**El selector ya existia** (la auditoria lo confirma en la seccion e; el enunciado decia que
no cambiaba de sesion). Lo que le faltaba y se agrego:

- formato `Nombre · dd/mm HH:mm` compartido, con tooltip de conteo y de id
- `optgroup` **OS** / **Telegram**, y ahora si lista las conversaciones de `/chat`
- al cambiar de sesion recarga tambien el modelo bloqueado de esa conversacion
- aviso de modelo degradado en el header

Lo que sigue sin existir en la burbuja (no estaba pedido): selector de perfil, crear sesion
nueva, y espejo de salida hacia Telegram.

### 5. Separar sesiones de chat propio (prioridad 3) — hecho

`listarSesionesTaski()` dejo de pedir `?source=telegram`. Pide la lista completa
(`limit=120`) y clasifica con `clasificarOrigen()`:

- `source === 'telegram'` → **telegram**
- `source === 'api_server'`, o id `pancho-os` / `os-chat-*` → **os**
- `cron`, `cli`, `desktop`, `a2a` → descartadas (son ejecuciones internas, no
  conversaciones)

Pestanas **Telegram / OS / Todas** en el cockpit y en `/chat`, por defecto **Todas**,
ordenadas por ultima actividad. En la burbuja el mismo corte va como `optgroup`.
El filtro se resuelve en el server (`?origen=`), no en el cliente.

### Arreglos colaterales

- `last_active` y `timestamp` de Hermes vienen en **epoch de segundos**. Se enviaban crudos
  al frontend, que hacia `new Date(segundos)` y pintaba fechas de **1970**. Se normalizan en
  el server con `aMilisegundos()`; `horaCorta()` de `/chat` tambien acepta epoch numerico.
- Cambiar de perfil en el cockpit hacia `if (perfilActivo === 'vps-default') return`, asi que
  **volver al VPS dejaba en pantalla los datos del otro nodo**. Ahora recarga siempre.

## Archivos tocados

| Archivo | Que cambio |
|---|---|
| `src/server/taski.handlers.ts` | catalogo de modelos, `aMilisegundos`, `clasificarOrigen`, filtro de origen, `renombrarSesionHermes`, perfiles derivados del health |
| `src/server/sesionAlias.handlers.ts` | **nuevo**: alias local de sesiones, dos pisos (Hermes + OS) |
| `src/server/chat.handlers.ts` | `renombrarConversacion` + seam `setRenombrarSesionHermesChat` |
| `src/os/lib/sesiones.ts` | **nuevo**: `etiquetaSesion` / `nombreSesion` / `fechaSesion` / `tooltipSesion` |
| `src/routes/api/taski/modelos.ts` | `session_id` en GET, `provider` en POST, devuelve fuente/aviso/modeloActivo |
| `src/routes/api/taski/sesiones.ts` | parametro `origen`, handler `PATCH` de renombrado |
| `src/routes/api/chat/$conversacionId.ts` | handler `PATCH` de renombrado |
| `src/os/components/OSHermesCockpit.tsx` | perfiles habilitados + tooltip, modelo real, pestanas, renombrado inline |
| `src/os/components/OSChat.tsx` | pestanas de origen, etiqueta con fecha, chip de conteo, renombrado inline |
| `src/os/components/TaskiBubble.tsx` | optgroups por origen, etiqueta con fecha, modelo por sesion, aviso |
| `supabase/migrations/20260906000100_sesiones_alias.sql` | **nuevo**: tabla `chat_sesiones_alias` |
| `src/server/taski.handlers.test.ts` | **nuevo**: 12 tests de la logica pura |
| `src/server/chat.handlers.test.ts` | 4 tests de renombrado |
| `package.json` | script `test:taski` |

## Que se probo y como

| Prueba | Resultado |
|---|---|
| `npm run lint` | 0 errores, 13 warnings preexistentes (`noInlineConfig`) |
| `npx tsc --noEmit` sobre los archivos tocados | 0 errores nuevos. Verificado contra la baseline con `git stash`: el unico error en `TaskiBubble.tsx` (`onPointerDown` en la linea 656/713) ya existia antes de tocar nada. El repo tiene una baseline grande de errores TS preexistentes en otros modulos (d3, astro, radar), por eso no hay script `typecheck`. |
| `npm run test:taski` | 12/12 |
| `npm run test:chat` | 11/11 (7 previos + 4 nuevos) |
| `npm run build` | verde |

**Lo que NO se pudo probar**: nada contra el VPS real. El `.env` local de `C:\DEV\Pancho-OS`
**no tiene `TASKI_TOKEN`** (el de produccion vive en `/opt/pancho-os/.env` del VPS), asi que
no habia credencial para hacer curl y no se invento ninguna. Todo el contrato con Hermes se
verifico contra el clon `C:\DEV\vps-hermes`, que puede diferir de la build instalada.

## Pendiente del lado de Hermes / VPS

### Curls exactos que hay que correr (en el VPS, o donde este `TASKI_TOKEN`)

```bash
# En el VPS:  export TOKEN=$(grep '^TASKI_TOKEN=' /opt/pancho-os/.env | cut -d= -f2-)
BASE=https://brain.franciscoabad.com/taski

# 1. El endpoint clave del punto 1: confirma que la build desplegada expone el
#    catalogo real y no solo el alias virtual.
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/model/options" | head -c 2000

# 2. Contraste: esto es lo que el OS leia antes (deberia traer solo hermes-agent).
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/v1/models"

# 3. Confirma que el PATCH de titulo existe (punto 2). 200 = renombrado real en
#    Hermes; 404/405 = el OS se queda con el alias local, que igual funciona.
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Prueba de renombrado"}' "$BASE/api/sessions/pancho-os"

# 4. Confirma el lock de modelo por sesion (punto 1c). Cambia <modelo> por uno
#    que haya salido en el paso 1.
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"model":"<modelo>","provider":"<proveedor>"}' "$BASE/api/sessions/pancho-os/model"

# 5. Confirma que las sesiones os-chat-* existen y con que source (punto 5).
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/sessions?limit=120" \
  | python3 -c "import sys,json;[print(s['source'], s['id'], repr(s.get('title'))) for s in json.load(sys.stdin)['data']]"
```

**Si el paso 1 devuelve 404 o una lista vacia**: el lado del OS ya esta listo igual (cae a
`/v1/models` y avisa en la UI). Falta definir `model_routes` en el `config.yaml` del perfil
`default` para que `/v1/models` al menos anuncie alias reales (deepseek, gpt, claude,
gemma), o actualizar Hermes a una build que traiga `_handle_model_options`.

### Para que Laptop y HomeLab se pongan verdes (punto 3)

Nada de esto es codigo de este repo y **no se toco**:

1. **Laptop**: en `/opt/pancho-os/.env` del VPS agregar
   `TASKI_BASE_LAPTOP=http://100.106.81.110:8642` y `TASKI_TOKEN_LAPTOP=<API_SERVER_KEY de la
   laptop>`; reiniciar pm2. La laptop debe estar encendida y en la tailnet.
2. **HomeLab**: habilitar el api_server en `C:\PanchoAtlas\hermes-local\home\.env`
   (`API_SERVER_ENABLED=true`, `API_SERVER_HOST=100.127.201.2`, `API_SERVER_PORT=8642`,
   `API_SERVER_KEY` nueva), reiniciar la tarea `PanchoAtlas-HermesA2A`, y en el VPS agregar
   `TASKI_BASE_HOMELAB=http://100.127.201.2:8642` y `TASKI_TOKEN_HOMELAB`.
3. Regla dura vigente: **nunca bindear a 0.0.0.0** en la laptop, solo la IP de Tailscale
   (`hermes-ops/CLAUDE.md`, regla 6).

Hasta que eso pase, los botones salen deshabilitados **con el motivo correcto en el
tooltip**, que es la mejora: antes salian grises sin explicacion y mintiendo el puerto.

### Otros pendientes que quedaron fuera de alcance

- **Migracion**: aplicar `20260906000100_sesiones_alias.sql` en el Postgres del OS. Sin
  ella, renombrar depende solo del PATCH de Hermes.
- **Espejo bidireccional con Telegram**: escribir desde el OS en un topic y que salga en
  Telegram sigue siendo fase 2 (~8 h, via `gateway/hooks.py` y `mirror_delivery`).
- **Selector de perfil en la burbuja**: sigue atada al VPS.
- **Que Hermes pregunte el nombre al crear la sesion**: eso es una linea en el SOUL o un
  skill de Hermes, no codigo del OS. Desde el OS ya se puede renombrar cuando quieras.

## Como probarlo local

```powershell
cd C:\DEV\Pancho-OS
git checkout fix/os-chat-sesiones-modelos-2026-09-06

# Verificacion sin red (esto es lo que corri yo):
npm run lint
npm run test:taski
npm run test:chat
npm run build

# App completa. Necesita TASKI_TOKEN en el .env para que Hermes responda:
# sin el, /api/taski/* devuelve 500 "TASKI_TOKEN no configurado" y las listas
# quedan vacias, pero la UI no revienta.
npm run dev
```

Luego, en el navegador:

- `http://localhost:3000/hermes` — perfiles con su estado real y tooltip; pestanas
  Telegram / OS / Todas; nombres con fecha; lapiz para renombrar; dropdown de modelo con el
  catalogo real y el aviso ambar si viene degradado.
- `http://localhost:3000/chat` — mismas pestanas en "Sesiones de Hermes", nombre con fecha,
  chip de conteo, lapiz para renombrar la conversacion.
- La burbuja TASKI (cualquier pagina) — selector agrupado OS / Telegram con el mismo
  formato de nombre y fecha.
