# Handover para Codex / GPT / Otros Agentes

> Actualizado 29 ago 2026. Lee esto ANTES de tocar nada de base de datos.

## Base de datos: dónde vive la verdad (LEER PRIMERO)

**Pancho OS ya NO usa Supabase Cloud.** Salió de Supabase el 23-ago-2026.

- **Producción corre sobre Postgres propio en el VPS** (`178.105.163.120`):
  contenedor Docker `pancho-os-postgres`, base `pancho_os`, expuesta por
  PostgREST + un proxy Caddy en `127.0.0.1:3001`. Hay también
  `pancho_os_staging` en el mismo contenedor.
- El código conserva la librería `@supabase/supabase-js` y las variables
  `SUPABASE_URL` / `SUPABASE_*` **solo por compatibilidad de nombre**. En
  producción `SUPABASE_URL=http://127.0.0.1:3001`, que es el Postgres propio,
  NO Supabase Cloud.
- **Supabase Cloud (`yfrrfmankgodpepbgyvu.supabase.co`) está DEPRECADO.** No
  aplicar migraciones ahí, no tratarlo como fuente de verdad. Solo queda vivo el
  bucket de **Storage** para grabaciones de voz (`src/pages/api/grabaciones.ts`),
  única atadura real a Cloud pendiente de reemplazar.

### TRAMPA IMPORTANTE: dos .env distintos

- El `.env` del **repo local** (`C:\DEV\Pancho-OS\.env`) TODAVÍA apunta a
  Supabase Cloud. Si inspeccionas el repo local vas a "ver Supabase" y concluir
  mal. **Eso NO es producción.**
- El `.env` de **producción** vive en el VPS (`/opt/pancho-os-next/.env`) y
  apunta al Postgres propio. El deploy lo preserva con `git clean -e .env`, así
  que nunca se sobreescribe desde el repo.
- Regla: cualquier duda sobre a qué DB apunta algo, verifícala **en el VPS**, no
  en el repo local.

### Cómo aplicar una migración (procedimiento correcto)

Las migraciones viven en `supabase/migrations/`. Se aplican al Postgres propio
del VPS, a las DOS bases:

```bash
scp supabase/migrations/<archivo>.sql root@178.105.163.120:/opt/pancho-os-db/pending/
ssh root@178.105.163.120
for db in pancho_os pancho_os_staging; do
  docker exec -i pancho-os-postgres psql -U pancho_os -d $db -v ON_ERROR_STOP=1 \
    < /opt/pancho-os-db/pending/<archivo>.sql
done
```

Usuario y base son `pancho_os` (NO `postgres`; ese rol no existe). Todas las
migraciones deben ser aditivas e idempotentes (`if not exists`). NUNCA aplicar
migraciones en Supabase Cloud.

## Infraestructura y despliegue

- **Apps**: `pancho-os` (Astro, PM2, puerto 4322, `os.franciscoabad.com`) y
  `pancho-os-next` (TanStack, PM2, puerto 4323, `next.os.franciscoabad.com`).
  La activa/nueva es `pancho-os-next`.
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) hace deploy
  automático al VPS en cada push a `master`. Preserva el `.env` del VPS.
- **Rama única**: `master`.
- **Reverse proxy**: Caddy con SSL para los dominios; apunta a los puertos Node,
  no a PostgREST.
- **Auth**: propia del OS (`src/server/osAuth.ts`, `OS_PASSWORD`, `X-OS-Token`,
  `os_devices`). No se usa Supabase Auth, Realtime ni Edge Functions.

## Reglas de trabajo

- Sin em dash en ningún copy. Español, sin anglicismos innecesarios.
- Commits: `tipo: descripción breve` (`feat`, `fix`, `docs`, `refactor`,
  `chore`). SIN `Co-Authored-By`.
- El brain canónico (gbrain, `https://brain.franciscoabad.com/mcp`) es una base
  Postgres SEPARADA del OS. Nunca fusionarlas.
