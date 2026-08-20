# Content Radar

Herramienta de investigación de contenido inspirada en AnswerThePublic. Recibe una palabra o tema semilla, genera variaciones de preguntas y búsquedas, consulta fuentes de autocompletado disponibles, normaliza y deduplica resultados, agrupa por intención y calcula un `opportunity_score` explicable.

## Uso

1. Ve a **Contenido** en el OS.
2. Haz clic en la pestaña **Radar** o visita `/os/contenido/radar`.
3. Escribe una palabra semilla, selecciona idioma, país y fuentes.
4. Ejecuta el radar.
5. Revisa las oportunidades ordenadas por score.
6. Haz clic en **Agregar al Content Planner** para crear una idea en `os_contenido_ideas`.

## Fuentes

- **Generador local**: siempre disponible. Crea variaciones con modificadores como qué, cómo, por qué, cuándo, dónde, para, en, sin, versus, ejemplos, herramientas, errores, precio, empresa, negocio y el país seleccionado.
- **Google Autocomplete**: opcional. Requiere `GOOGLE_API_KEY`. Sin clave devuelve `[]`.
- **Bing Autosuggest**: opcional. Requiere `BING_API_KEY`. Sin clave devuelve `[]`.
- **YouTube**: opcional. Requiere `YOUTUBE_API_KEY`. Sin clave devuelve `[]`.

> Nota: Google y YouTube no ofrecen un endpoint público oficial de autocompletado JSON. Los adaptadores están preparados para integrarse con un proxy o servicio de suggest cuando exista credencial. No se usan respuestas falsas.

## Variables de entorno

```bash
GOOGLE_API_KEY=tu_clave_opcional
BING_API_KEY=tu_clave_opcional
YOUTUBE_API_KEY=tu_clave_opcional
```

## API

### POST `/api/os/contenido/radar`

Ejecuta el radar.

Body:
```json
{
  "seed": "marketing digital",
  "lang": "es",
  "country": "Ecuador",
  "sources": ["local", "google", "bing", "youtube"]
}
```

Respuesta:
```json
{
  "seed": "marketing digital",
  "opportunities": [...],
  "sourcesUsed": ["local"],
  "warnings": []
}
```

### PUT `/api/os/contenido/radar`

Promueve una oportunidad al Content Planner.

Body:
```json
{
  "opportunity": {
    "query": "que es marketing digital",
    "intent": "aprender",
    "opportunityScore": 0.72,
    "source": "local",
    "cluster": "aprender / marketing digital",
    "suggestedFormats": ["carrusel", "guia"],
    "suggestedPlatforms": ["LinkedIn", "Instagram", "Blog"]
  }
}
```

## Score

El `opportunity_score` es una heurística entre 0 y 1 basada en:

- **Señal de aparición**: frecuencia del query dentro del cluster.
- **Relevancia temática**: presencia de tokens de la semilla.
- **Autoridad de fuente**: peso heurístico por fuente (Google > YouTube > Bing > local).
- **Potencial de repurposing**: intenciones que se adaptan a varios formatos puntúan más alto.
- **Saturación**: queries más largas y genéricas reciben penalización.

No representa volumen de búsqueda real. Es una señal local para priorizar.

## Migración de schema

Para guardar metadatos del radar en `os_contenido_ideas`, ejecuta:

```bash
supabase/migrations/20260820000000_contenido_radar_fields.sql
```

Columnas opcionales añadidas:
- `source_query`
- `intent`
- `opportunity_score`
- `source`
- `cluster`
- `suggested_formats`
- `suggested_platforms`

Si la migración no está aplicada, la API guarda la idea base igual y muestra un warning.

## Tests

```bash
npm run test:radar
```

## Limitaciones

- Las fuentes externas devuelven `[]` hasta que se configure una API key y un endpoint válido.
- El score no usa volumen de búsqueda real; es una señal local.
- El clustering es simple (intención + raíz de la semilla).
