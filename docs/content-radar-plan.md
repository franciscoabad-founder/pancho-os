# Plan: Content Radar MVP para Pancho-OS

## Estado actual revisado

> Nota de ruta: se verificó que el checkout no tiene `apps/web`. El código real vive en la raíz (`src/`, `supabase/`, `docs/`). Todas las rutas del plan usan la estructura actual.

- Proyecto Astro + React + Supabase (`@supabase/supabase-js`).
- Autorización OS vía cookie `os_auth` + `OS_AUTH_TOKEN` (`src/os/lib/osAuth.ts`).
- Módulo Contenido actual:
  - Página: `src/pages/contenido.astro` renderiza `OSContenido`.
  - API: `src/pages/api/contenido.ts` contra tabla `os_contenido_ideas`.
  - UI compartida en `src/os/components/ui/` (Button, Card, PageHeader, Toast, ConfirmSheet, Spinner, EmptyState, Field).
  - Layout OS: `src/layouts/OSLayout.astro` con navegación fija en `navGroups`.
- Tests usan `node:test` con `node --experimental-strip-types`.

## Enfoque general

Página separada accesible desde `/os/contenido/radar`, más pestañas dentro de `/contenido` para alternar entre *Pipeline* y *Radar*. El core de generación, normalización, intención y scoring vive en `src/lib/contenido/radar/` (puro TypeScript, testeable). Los adaptadores de fuentes externas son opt-in y no bloquean el MVP.

## Decisiones de arquitectura

1. **Vista**: página Astro `src/pages/os/contenido/radar.astro` + componente React `src/os/components/contenido/OSContentRadar.tsx`. Navegación en `/contenido` con pestañas internas.
2. **API**: endpoint Astro `src/pages/api/os/contenido/radar.ts` protegido con `isOsAuthorized`. Expone:
   - `POST /api/os/contenido/radar` → recibe `{ seed, lang, country, sources }` y devuelve oportunidades procesadas.
   - `POST /api/os/contenido/radar/promote` → recibe oportunidad y la inserta en `os_contenido_ideas`.
3. **Dominio**: `src/lib/contenido/radar/`:
   - `generator.ts`: variaciones por modificadores + país/región.
   - `normalizer.ts`: minúsculas, espacios, acentos, equivalencias, deduplicación.
   - `intent.ts`: clasificación de intención por palabras clave.
   - `scorer.ts`: `opportunity_score` explicable con señal, relevancia, autoridad, repurposing, saturación.
   - `cluster.ts`: agrupamiento simple por intención + raíz temática.
   - `sources/`: adaptadores para Google, Bing, YouTube (opt-in, devuelven vacío si no hay credenciales).
4. **Schema**: migración `supabase/migrations/20260820000000_contenido_radar_fields.sql` que añade columnas opcionales a `os_contenido_ideas` (solo si existe) con `IF NOT EXISTS`, compatibles con la API actual. Los campos nuevos: `source_query`, `intent`, `opportunity_score`, `source`, `cluster`, `suggested_formats`, `suggested_platforms`.
5. **Compatibilidad**: la API `/api/contenido` POST ya acepta campos extra condicionalmente (`url_referencia`, `transcript`). Extendemos el mismo patrón para los nuevos metadatos: solo se insertan si vienen y si la columna existe. Si Supabase rechaza por columna inexistente, se guarda la idea base igual y se loguea como warning.
6. **Fuentes externas**: sin scraping. Adaptadores usan variables de entorno opcionales (`GOOGLE_API_KEY`, `BING_API_KEY`, `YOUTUBE_API_KEY`). Sin clave, retornan `[]` y el Radar funciona con el generador local.
7. **No inventar datos**: los resultados externos reales solo vienen si hay API key. El generador local produce variaciones temáticas legítimas.

## Archivos a crear

- `src/lib/contenido/radar/types.ts`
- `src/lib/contenido/radar/generator.ts`
- `src/lib/contenido/radar/normalizer.ts`
- `src/lib/contenido/radar/intent.ts`
- `src/lib/contenido/radar/scorer.ts`
- `src/lib/contenido/radar/cluster.ts`
- `src/lib/contenido/radar/index.ts`
- `src/lib/contenido/radar/sources/google.ts`
- `src/lib/contenido/radar/sources/bing.ts`
- `src/lib/contenido/radar/sources/youtube.ts`
- `src/lib/contenido/radar/sources/index.ts`
- `src/lib/contenido/radar/radar.test.ts`
- `src/pages/api/os/contenido/radar.ts`
- `src/os/components/contenido/OSContentRadar.tsx`
- `src/pages/os/contenido/radar.astro`
- `supabase/migrations/20260820000000_contenido_radar_fields.sql`
- `docs/content-radar.md`

## Archivos a modificar

- `src/pages/contenido.astro`: añadir pestañas Pipeline/Radar y enlace a `/os/contenido/radar`.
- `src/os/components/OSContenido.tsx`: soportar renderizado de pestañas (o dejar que la página Astro lo maneje). Se opta por dejar `OSContenido` intacto y añadir pestañas en la página Astro.
- `src/layouts/OSLayout.astro`: añadir `/os/contenido` a `ms` map y ajustar `isActive` si es necesario (ya funciona con prefijo). No se modifica `navGroups`; el acceso queda desde la página de Contenido.
- `package.json`: añadir script `test:radar` opcional o incluir en `test:contenido`.

## Pasos de implementación

1. **Dominio**: implementar `generator`, `normalizer`, `intent`, `scorer`, `cluster` y tests.
2. **Fuentes**: implementar adaptadores stub con variables de entorno.
3. **API**: implementar `/api/os/contenido/radar` y `/api/os/contenido/radar/promote`.
4. **Schema**: crear migración opcional de columnas.
5. **UI**: implementar `OSContentRadar.tsx` y página Astro.
6. **Navegación**: pestañas en `contenido.astro`.
7. **Tests**: ejecutar `npm run test:contenido` y nuevo test de radar.
8. **Build**: ejecutar `npm run build` y corregir errores.
9. **Documentación**: crear `docs/content-radar.md`.

## Criterios de calidad a verificar

- Tests unitarios pasan.
- Build de Astro pasa sin errores.
- No se exponen secretos.
- No se inventan datos de APIs.
- La promoción a `os_contenido_ideas` funciona con y sin columnas extras.

## Próximo paso tras el plan

Implementar paso a paso y reportar archivos, rutas, tests y build al finalizar.
