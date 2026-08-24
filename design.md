# Pancho OS — Design System

Fuente de verdad visual del OS. Generado en Claude Design (24-ago-2026),
sincronizado con la marca personal de Francisco Abad (Ultramarine v5,
`marcapersonal-visual` en gbrain). Archivos reales en [`design-system/`](design-system/).

## Estado real vs. este sistema

Auditoría hecha antes de generar esto: la paleta del OS (`src/styles/os.css`)
**ya seguía Ultramarine v5 casi exacto** (`#3B4ED9` ultramarine, `#8A6F3D`
bronze). El problema no era el color — era la tipografía: el OS carga **4
familias compitiendo** (Montserrat display, Inter body, JetBrains Mono,
Nunito rounded) y cero jerarquía real. Este sistema resuelve exactamente eso:
Gotham real (13 archivos, self-hosted) como única familia display+body.

**No aplicado todavía al código en vivo** — este documento y `design-system/`
son la referencia. Migrar `os.css` a Gotham y consolidar tipografía es el
siguiente paso, deliberadamente no hecho en automático porque cambia la cara
visual de toda la app en producción.

## Dirección

Editorial, profundo, premium. Nunca juguetón, nunca "agencia creativa",
nunca glassmorphism ni gradientes genéricos de IA. La jerarquía viene del
peso tipográfico, no del ruido de color. Los números tienen su propio color
(Champagne) para que la prueba real se distinga de la decoración.

## Tokens de color (`design-system/tokens/colors.css`)

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0E1738` | Fondo dark por defecto |
| `--royal` | `#1A2B6B` | Cards elevadas sobre ink |
| `--charcoal` | `#1A1A1A` | — |
| `--ultramarine` | `#3B4ED9` | **Único acento general** — CTAs, links, nav activo, focus ring |
| `--ultralight` | `#6B7AE8` | Hover del acento |
| `--champagne` | `#B5985A` | **Solo números** — métricas, KPIs, credenciales. Nunca decorativo, nunca CTA |
| `--bronze` | `#8A6F3D` | Hover de champagne |
| `--linen` | `#FAFAF7` | Fondo claro — nunca blanco puro |
| `--slate-light/mid/dark` | `#E8EAF0` / `#6B7280` / `#2D3748` | Bordes, texto secundario, texto principal en claro |
| `--white` | `#FFFFFF` | Cards sobre linen |

Semánticos: `--surface-canvas-dark/light`, `--surface-card-dark/light`,
`--border-dark/light`, `--text-heading/body/muted-dark/light`,
`--accent`/`--accent-hover`, `--metric`/`--metric-hover`, `--focus-ring`.

## Tipografía (`design-system/tokens/fonts.css` + `typography.css`)

**Gotham real, self-hosted**, 13 archivos en `design-system/fonts/` (Thin
100 → Black 900, roman + itálica). Montserrat queda como fallback
documentado, no como familia primaria — corrige el pendiente abierto en el
canon de marca ("confirmar Gotham").

Jerarquía por peso, no por familia: Black 900 (números hero de impacto),
Bold 700 (H1/headers de sección), Medium 500 (labels/eyebrows/nav), Book 400
(cuerpo), Light 300 itálica (captions/taglines). Nunca serifa.

Escala: display 60/44px, H1 32px, H2 24px, H3 19px, body 16px, label/small
13px, caption 12px, métricas 56/32/20px. Tracking: eyebrow 0.14em, label
0.06em, wordmark light 0.18em / bold 0.02em.

## Espaciado y forma (`design-system/tokens/spacing.css`)

Escala: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128px.
Radios: 4px controles chicos, 8px default (botones/inputs/cards), 14px
contenedores grandes, pill completo para tags/switches/barras de progreso.
Sombra única y difusa (`--shadow-card-dark/light`), nunca neumorfismo ni
glow de color. Motion: 120–200ms, `cubic-bezier(.4,0,.2,1)`, hover cambia
solo color (nunca escala/rebote).

## Fundamentos de contenido

- Español por defecto. Voz directa, ejecutiva, sin relleno. Primera persona
  activa en copy narrativo ("construí", "diseñé", "operé").
- Sin emoji. Sin em dash — usar puntos, comas, dos puntos o "·".
- Sin el patrón "no es X, es Y". Afirmar directo.
- Sentence case en labels/headings de UI, nunca Title Case. Eyebrows en
  mayúsculas con tracking.
- Los números son prueba, no decoración: unidad real, nunca redondeados
  para impacto ("78%", "12 días", no "casi 80%").

## Componentes (`design-system/components/`)

12 primitivos, cada uno con `.jsx` + `.d.ts` + `.prompt.md` + preview `.html`:

- **forms/**: Button, Input, Select, Checkbox, Switch
- **feedback/**: Badge, Tooltip, Dialog
- **navigation/**: Tabs
- **data/**: Card, MetricCard, ProgressBar

`MetricCard` y `ProgressBar` se agregaron más allá del set mínimo porque
KPIs/porcentaje de hábitos son centrales al producto.

## UI kit de referencia (`design-system/ui_kits/pancho-os/`)

Recreación clickeable de 4 pantallas: Sidebar, Dashboard (Hoy), Tasks
(Tareas), Habits (Hábitos & Salud), Finance (Finanzas). Construidas desde
el brief de marca, no desde el código real — son referencia de dirección
visual, no una copia 1:1 de lo que ya existe en `src/os/components/`.

## Iconografía — resuelto en Stitch

Stitch generó un set propio, coherente en las 5 pantallas ancla: trazo
simple, un ícono distintivo por módulo (Hoy, Salud, Finanzas, GFIT, Cerebro
visibles en el sidebar), estado activo en Ultramarine. Sin exportar como
SVG individuales todavía — hoy viven inline en el `code.html` de cada
pantalla en `design-system/stitch/`. Extraerlos como set reusable es el
siguiente paso concreto.

## Logo — sigue pendiente

Ninguno de los dos sistemas (Claude Design ni Stitch) trajo el logo real.
Stitch usa una foto de perfil genérica en el sidebar en vez del wordmark
"FRANCISCO ABAD". Si existen PNGs reales en `00_Brand/contexto marca/`
(OneDrive), traerlos a `design-system/assets/` y reemplazar.

## Pantallas ancla — entregadas por Stitch (24-ago-2026)

`design-system/stitch/stitch_pancho_os_operational_cockpit/`, 5 pantallas
con `screen.png` + `code.html` cada una, más su propio `DESIGN.md` (mismo
sistema Ultramarine v5, coincide con Claude Design en color/tipografía,
agrega specs de grid/elevación/componentes que Claude Design no detalló):

- **Hoy (desktop, light)** — One Domino como jerarquía #1, priority stack,
  discomfort first, protocolos diarios. Correcto.
- **Finanzas (desktop, light)** — patrimonio neto hero en champagne,
  4 stats, tarjetas de cuenta por tipo, tabla de gastos con monto
  original + USD. Correcto en estructura.
- **Salud (desktop, dark)** — tabs de submódulo, 4 stat cards, sección de
  sueño con gráfica de barras. Correcto en estructura.
- **GFIT sesión activa (mobile)** — exactamente lo pedido: números enormes,
  timer circular de descanso, botón ancho completo. El mejor resultado de
  las 5.
- **Cerebro (desktop)** — grafo tipo constelación sobre fondo Ink, panel
  lateral con búsqueda/tags/notas recientes. Atmósfera correcta.

**Gaps reales encontrados al revisar (no asumidos, vistos en las capturas):**
1. Contenido de Cerebro en inglés ("Feynman Technique Application", "Q3
   Revenue Projections") — el sistema pide español por defecto; Stitch no
   lo siguió en esa pantalla específica.
2. Los datos de ejemplo no reflejan la forma real de los datos: Finanzas
   muestra "Cold Wallet"/"Exchange Staking" genéricos en vez de tus cuentas
   reales (Metamask, Binance, Wise, Takenos, UglyCash); Salud muestra
   "Deuda de sueño: 4.5 hrs" con una escala distinta a tu modelo real (14
   días, tope 2.5 noches, ~24h). Es información nueva para Stitch, no un
   error — nunca se le dio el modelo real de esos módulos.
3. Fechas de ejemplo desactualizadas ("Miércoles 24 de Abril", "Octubre
   2023") — cosmético, no importa para tomar la dirección visual.

## Siguiente paso concreto

1. Extraer el set de íconos del `code.html` de Stitch como SVGs
   individuales reusables.
2. Traer los PNG del logo real cuando los ubiques en OneDrive.
3. Migrar `src/styles/os.css` y `src/routes/__root.tsx` de las 4 fuentes
   actuales (Montserrat/Inter/JetBrains Mono/Nunito) a Gotham self-hosted +
   la escala tipográfica de este sistema — cambio de superficie completa,
   revisar en `next.os` antes de tocar producción real.
4. Portar los 12 componentes primitivos de Claude Design (`Card`,
   `MetricCard`, `ProgressBar`, etc.) a `src/os/components/ui/`, usando el
   layout real de las 5 pantallas de Stitch como referencia de composición.
5. Correr el prompt 2 de `docs/stitch-prompts-2026-08-23.md` (extensión al
   resto de pantallas) una vez aprobadas estas 5 ancla.
