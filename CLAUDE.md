# CLAUDE.md - Pancho OS System Instructions

## Quién soy

Francisco Abad (Pancho), founder ecuatoriano. Marca personal centrada en "vuelvo alcanzable lo imposible".

## Definición del Proyecto: Pancho OS

Pancho OS es el cockpit personal y operativo de Pancho Abad, alojado de forma independiente en `https://os.franciscoabad.com`.

- **Repositorio**: `franciscoabad-founder/pancho-os` (Standalone Repo en `C:\DEV\Pancho OS`)
- **Producción**: Hetzner VPS (`pancho-automations-01`, IP: `178.105.163.120`)
- **Servicio Node SSR**: PM2 process `pancho-os` escuchando en `0.0.0.0:4322`
- **Reverse Proxy**: Docker Caddy (`n8n-caddy-1`) proxying `os.franciscoabad.com` -> `172.18.0.1:4322` con SSL Let's Encrypt automático.
- **Firewall UFW**: Permite `172.18.0.0/16` hacia el puerto `4322/tcp`.

---

## Servidor MCP (Especificación 2026-07-28)

El repositorio expone un servidor MCP nativo sin estado (Stateless HTTP) para consumo de agentes de IA:

- **Endpoint Público**: `https://os.franciscoabad.com/api/mcp`
- **Autenticación**: Cabecera `X-OS-Token` o `Authorization: Bearer <OS_API_TOKEN>`
- **Enrutamiento por Cabeceras**: `Mcp-Method` (`tools/list`, `tools/call`) y `Mcp-Name` (`agenda_get_eventos`, etc.)
- **Caché de Catálogo**: `tools/list` responde `ttlMs: 3600000` y `cacheScope: "global"`
- **MRTR (Multi Round-Trip Requests)**: Para acciones sensibles (ej. `agenda_delete_evento`, `finanzas_log_gasto`), el MCP devuelve `resultType: "input_required"`, exigiendo confirmación interactiva `inputResponses: { confirm: true }`.

---

## Cómo Trabajamos

- Tono: práctico, directo, ejecutivo.
- Sin em dashes (`-`) en ningún copy, respuesta ni documento. Sin excepciones.
- Sin anglicismos innecesarios en español.
- Regla de commits: `tipo: descripción breve` (`feat`, `fix`, `docs`, `refactor`, `chore`). SIN `Co-Authored-By`.

---

## GBrain - Reglas de Escritura (Obligatorias)

1. **Tags Válidos (Lista Cerrada)**:
   `braintech`, `cortex`, `taskr`, `rafik`, `arazza`, `codeis`, `kronek`, `fonquito`, `flow`, `os`, `panchoatlas`, `gbrain`, `hermes`, `n8n`, `vps`, `marca`, `personal`, `familia`, `salud`, `finanzas`, `contenido`, `gtm`.
   *PROHIBIDO crear tags nuevos. Usar en minúsculas.*
2. **Conectividad del Grafo**: Toda página creada en el brain debe incluir al menos un wikilink `[[slug]]` a una página existente y cerrar con `Relacionado: [[slug-1]] [[slug-2]]`.
3. **Slugs**: Formato `kebab-case`. Notas de fecha llevan `-YYYY-MM-DD`.

---

## GBrain Search Guidance

GBrain is the canonical memory of Francisco Abad (`https://brain.franciscoabad.com/mcp`).
Use `pancho-brain` MCP tools to query or record system architecture, learnings, and decisions.
