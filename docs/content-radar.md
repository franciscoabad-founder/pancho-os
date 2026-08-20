# Content Radar

Herramienta de investigación de contenido inspirada en AnswerThePublic. Recibe una palabra o tema semilla, genera variaciones locales, consulta fuentes externas reales de señales de búsqueda, normaliza, deduplica conservando la trazabilidad de fuentes, agrupa por intención y calcula un `opportunity_score` explicable.

## Uso

1. Ve a **Contenido** en el OS.
2. Haz clic en la pestaña **Radar** o visita `/os/contenido/radar`.
3. Escribe una palabra semilla, selecciona idioma, país y fuentes.
4. Ejecuta el radar.
5. Revisa el bloque **Fuentes de esta búsqueda** para ver qué fuente respondió, cuáles son locales y cuáles fallaron o no están configuradas.
6. Haz clic en **Agregar al Content Planner** para crear una idea en `os_contenido_ideas`.

## Fuentes

| Fuente | Qué devuelve | Tipo de señal | Variable | Obligatoria | Estado sin variable |
|---|---|---|---|---:|---|
| Generador local | Variaciones de la semilla (qué, cómo, versus, precio, país…) | `generated` (no observada) | — | — | siempre disponible |
| Google Autocomplete (vía SerpAPI) | Sugerencias reales de autocompletado de Google | `autocomplete-suggestion` | `SERPAPI_API_KEY` | No | `disabled` |
| Bing Related Searches (vía SerpAPI) | Búsquedas relacionadas de una página real de resultados de Bing | `related-search-query` | `SERPAPI_API_KEY` | No | `disabled` |
| YouTube Search (YouTube Data API v3) | Títulos de videos reales relacionados con el tema | `related-video-topic` | `YOUTUBE_API_KEY` | No | `disabled` |

### Decisiones de integración (por qué estos proveedores)

- **Google**: no existe una API pública oficial de autocompletado de Google. Se usa [SerpAPI Google Autocomplete](https://serpapi.com/google-autocomplete-api), un proveedor externo legítimo con contrato documentado y estable (`GET https://serpapi.com/search.json?engine=google_autocomplete&q=...&hl=...&gl=...` → `suggestions[].value`). No se hace scraping del navegador.
- **Bing**: Microsoft retiró las Bing Search APIs v7 (incluido `api.bing.microsoft.com/v7.0/Suggestions`) el **2025-08-11**; las claves legacy devuelven HTTP 410. No existe endpoint oficial de autosuggest. Se usa SerpAPI `engine=bing` extrayendo `related_searches[].query`. **No es autocompletado**: se etiqueta como `related-search-query`.
- **YouTube**: la YouTube Data API no tiene endpoint de autocompletado. Se usa el endpoint oficial [`search.list`](https://developers.google.com/youtube/v3/docs/search/list) y los títulos de videos se tratan como **temas de videos relacionados** (`related-video-topic`), nunca como "autocomplete". Ojo con la cuota: `search.list` cuesta 100 unidades por llamada (cuota diaria por defecto: 10.000).

## Configuración de credenciales

Toda credencial vive solo en el entorno del servidor (`.env` local, secrets del VPS). Nunca en el repo, nunca en la base de datos, nunca en logs.

### `SERPAPI_API_KEY` (Google + Bing)

1. Crea una cuenta en [serpapi.com](https://serpapi.com/users/sign_up) (hay plan gratuito).
2. Copia tu API key del dashboard.
3. Define `SERPAPI_API_KEY=...` en `.env` (local) o en el entorno de PM2 (producción) y reinicia la app.
4. Verifica: `GET /api/os/contenido/radar/status` debe mostrar `google` y `bing` con `configured: true`.
5. Limitación: cada búsqueda del radar consume 1 crédito SerpAPI por motor seleccionado.

### `YOUTUBE_API_KEY` (YouTube)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto.
2. Habilita **YouTube Data API v3**.
3. Crea una credencial tipo **API key** (restríngela a la YouTube Data API).
4. Define `YOUTUBE_API_KEY=...` en el entorno y reinicia.
5. Verifica con `/api/os/contenido/radar/status`.
6. Limitaciones: 100 unidades de cuota por llamada; errores `403 quotaExceeded` se reportan como estado `error` de la fuente sin romper el radar.

### Comportamiento sin credenciales

Sin ninguna variable configurada el radar funciona igual con el generador local, y la UI muestra cada fuente externa como `no configurada`. Los resultados locales se etiquetan `Generada local` y **nunca** como búsquedas observadas.

## API

### POST `/api/os/contenido/radar`

Ejecuta el radar.

Body:
```json
{
  "seed": "marketing digital",
  "lang": "es",
  "country": "Ecuador",
  "sources": ["local", "google", "bing", "youtube"],
  "options": { "timeoutMs": 8000 }
}
```

- `seed`: requerido, máx. 120 caracteres.
- `sources`: subset de `local|google|bing|youtube`; valores desconocidos se descartan.
- `options.timeoutMs`: timeout por fuente, limitado a 500–20000 ms.

Respuesta (recortada):
```json
{
  "seed": "marketing digital",
  "lang": "es",
  "country": "Ecuador",
  "queries": [
    {
      "query": "que es marketing digital",
      "source": "google",
      "sources": ["google", "local"],
      "observedSources": ["google"],
      "observed": true,
      "generated": true,
      "signalTypes": ["autocomplete-suggestion", "generated"]
    }
  ],
  "opportunities": [
    {
      "query": "que es marketing digital",
      "sourceType": "mixed",
      "observed": true,
      "generated": true,
      "intent": "aprender",
      "cluster": "aprender / marketing digital",
      "opportunityScore": 0.71,
      "volume": null,
      "capturedAt": "2026-08-20T02:00:00.000Z"
    }
  ],
  "sourceStatuses": [
    { "id": "local", "label": "Generador local", "configured": true, "available": true, "status": "ok", "resultCount": 19 },
    { "id": "google", "label": "Google Autocomplete", "configured": false, "available": false, "status": "disabled", "resultCount": 0, "reason": "SERPAPI_API_KEY no configurada" }
  ],
  "sourcesUsed": ["local"],
  "warnings": [],
  "generatedAt": "2026-08-20T02:00:00.000Z"
}
```

Reglas de trazabilidad:
- `sources`: todas las fuentes donde apareció la query.
- `observedSources`: solo fuentes externas que la observaron de verdad.
- `sourceType`: `observed` (solo externa), `generated` (solo local), `mixed` (ambas).

### GET `/api/os/contenido/radar/status`

Diagnóstico sanitizado de configuración (sin valores de credenciales, sin headers, sin URLs con secretos):

```json
{
  "sources": [
    { "id": "google", "label": "Google Autocomplete", "configured": false, "available": false, "status": "disabled", "reason": "SERPAPI_API_KEY no configurada", "setupInstructions": "..." }
  ],
  "generatedAt": "..."
}
```

### POST `/api/os/contenido/radar/promote`

Promueve una oportunidad al Content Planner (`os_contenido_ideas`). El servidor valida todo el payload: query ≤ 200 chars, `intent` dentro del enum, `opportunityScore` numérico entre 0 y 1, arrays sanitizados, `capturedAt` ISO válida. Payloads inválidos reciben 400.

Body:
```json
{
  "opportunity": {
    "query": "que es marketing digital",
    "intent": "aprender",
    "opportunityScore": 0.72,
    "source": "google",
    "sources": ["google", "local"],
    "observedSources": ["google"],
    "cluster": "aprender / marketing digital",
    "suggestedFormats": ["carrusel", "guia"],
    "suggestedPlatforms": ["LinkedIn", "Instagram", "Blog"],
    "capturedAt": "2026-08-20T02:00:00.000Z"
  }
}
```

Si las columnas de metadata no existen todavía en Supabase, la idea base se guarda igual y la respuesta incluye un `warning` (fallback solo ante errores reales de schema; errores de auth/conexión/validación no se ocultan).

## Score

El `opportunity_score` es una heurística entre 0 y 1 con cinco componentes (pesos entre paréntesis):

- **Señal observada** (0.25): 0.1 si solo la generó el motor local; 0.5/0.7/0.9 si fue observada en 1/2/3+ fuentes externas. Si una fuente aporta volumen real, se usa escala logarítmica y se atribuye (`volumeSource`, `volumePeriod`, `volumeUnit`).
- **Relevancia temática** (0.25): tokens de la semilla presentes en la query.
- **Autoridad de fuente** (0.15): peso heurístico por fuente (Google > YouTube > Bing > local).
- **Potencial de repurposing** (0.20): intenciones que se adaptan a varios formatos puntúan más alto.
- **Saturación** (0.15, invertida): queries más largas y genéricas reciben penalización.

Sin dato de volumen real, `volume` es `null` y la primera línea de la explicación indica que es una **señal cualitativa**. El score nunca se presenta como volumen de búsqueda.

## Migraciones de schema

```bash
supabase/migrations/20260820000000_contenido_radar_fields.sql    # metadata base del radar
supabase/migrations/20260821000000_contenido_radar_observed.sql  # trazabilidad de fuentes observadas
```

Columnas añadidas (todas `if not exists`, idempotente, sin cambios destructivos):
- `source_query`, `intent`, `opportunity_score`, `source`, `cluster`, `suggested_formats`, `suggested_platforms`
- `observed_sources text[]`, `captured_at timestamptz`, `source_metadata jsonb`

La segunda migración termina con `notify pgrst, 'reload schema'` para que PostgREST recargue el schema. Aplícalas en el SQL editor de Supabase verificando antes que estás en el proyecto correcto.

## Tests

```bash
npm run test:radar      # dominio + adapters (fetch mockeado) + validación de promoción
npm run test:contenido  # dominio del Content Planner
npm run build
```

Los tests de adapters cubren: sin credencial, respuesta realista, timeout, HTTP 401/403/429, JSON malformado, merge multi-fuente, score con/sin volumen y no-exposición de secretos. No dependen de internet.

## Limitaciones

- Google/Bing dependen de SerpAPI (servicio de pago con plan gratuito limitado). Sin `SERPAPI_API_KEY` esas fuentes quedan `disabled`.
- YouTube `search.list` consume cuota rápido (100 unidades/llamada); no es autocomplete.
- El score sigue siendo heurístico; ninguna fuente conectada aporta volumen real todavía.
- El clustering es simple (intención + raíz de la semilla).
- Fuentes previstas no implementadas: Google Trends, Reddit, TikTok, Search Console, comentarios de LinkedIn, preguntas de Telegram, GBrain. La arquitectura de adapters (`src/lib/contenido/radar/sources/`) ya soporta añadirlas.
