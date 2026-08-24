# Prompts para Google Stitch — Pancho OS

Prompts preparados el 23-ago-2026 para diseñar las pantallas del OS en
Stitch, usando el design system de `design.md`. Pendiente de correr.

## Setup del proyecto en Stitch

**Company name and blurb:**
```
Pancho OS — cockpit operativo personal de Francisco Abad. Sistema web (desktop
+ PWA) donde un founder ecuatoriano gestiona tareas, agenda, salud, hábitos,
finanzas, contenido y su segundo cerebro, todo con datos reales y agentes de
IA (Hermes) leyendo/escribiendo por MCP. Territorio de marca: "el constructor
con pruebas" — construye y opera los sistemas él mismo, desde adentro.
```

**Link code from GitHub:** `https://github.com/franciscoabad-founder/pancho-os`

**Add fonts, logos and assets:** carpeta de marca en OneDrive
`00_Brand/contexto marca/` (PNGs del logo, y ahora también
`design-system/fonts/` en este repo con Gotham real).

**Any other notes?:**
```
Dirección: editorial, profunda, premium. Nunca juguetona, nunca "agencia
creativa", nunca glassmorphism ni gradientes genéricos de IA.

Paleta (ya en uso, mantener): Ink #0E1738 (fondo dark), Royal #1A2B6B
(cards dark), Ultramarine #3B4ED9 (acento/CTA/links — único acento
"activo"), Ultra-light #6B7AE8 (hover), Champagne #B5985A / Bronze #8A6F3D
(SOLO para métricas, KPIs, cifras — nunca decorativo), Linen #FAFAF7
(fondo claro, nunca blanco puro), Slate-dark #2D3748 (texto).

Tipografía: Gotham (archivos reales en design-system/fonts/), fallback
Montserrat. Geométrica sans-serif, nunca serifa. Jerarquía por peso: Black
900 para impacto, Bold 700 H1, Medium 500 labels/eyebrows, Book 400 cuerpo.

Voz: directa, ejecutiva, sin relleno. Sin emojis. Sin em dash.

El sistema actual tiene la paleta correcta pero cero jerarquía tipográfica
y demasiada densidad visual (íconos Material genéricos, sin aire entre
secciones). El objetivo es que se sienta como un instrumento premium, no
un dashboard SaaS genérico.
```

## Prompt 1 — pantallas ancla (5)

```
Usando el design system que acabamos de configurar (Ultramarine v5): diseña
las pantallas ancla de Pancho OS, un cockpit operativo personal. Estas 5
definen el lenguaje visual completo — el resto de la app se extiende desde
aquí, así que llévalas al máximo nivel de pulido.

CONTEXTO DE PRODUCTO
Sistema operativo personal de un founder ecuatoriano. Se usa a diario, en
desktop y celular. No es un dashboard SaaS genérico — es un instrumento
personal, denso en información real pero con jerarquía clara. El usuario ya
conoce el sistema; el diseño no vende, opera.

SISTEMA DE ÍCONOS (spec propia, no Material Symbols genéricos)
Necesito un set de íconos cuasi-originales, coherente en todas las pantallas:
- Trazo simple, un solo peso de línea (2px a escala 24px), esquinas con
  radio sutil consistente — nunca filled/solid, nunca duotono.
- Geometría que combine con la tipografía Gotham/Montserrat: formas
  construidas, no orgánicas. Nada de emoji ni ilustración.
- Un ícono por módulo core, distintivo pero de la misma familia visual:
  Hoy, Sistema, Tareas, Agenda, Salud, GFIT, Hábitos, Juego, Finanzas, CRM,
  Contenido, Cerebro, Diario, Grabar.
- Estados: el ícono activo (página actual en el nav) usa el acento
  Ultramarine; inactivo usa slate-mid; nunca cambia de trazo a relleno al
  activarse, solo de color.

PANTALLA 1 — Home ("Hoy")
Dashboard diario. De arriba a abajo: header con fecha completa en español
y el "modo del día" (Maker/Manager/Off) como pill. "One Domino" (la única
prioridad del día, campo editable, prominente — es LA jerarquía #1 de la
pantalla). Priority Stack (lista corta con hasta 5 ítems). Wins recientes
(chips o tarjetas pequeñas, algo que dé dopamina visual al agregar uno).
Checklist diario de 7 hábitos con su ancla conductual en texto secundario
debajo de cada uno, checkbox grande fácil de tocar en móvil. "Discomfort
first" como bloque aparte, tono distinto (más serio). Principios (lista de
6, tipografía pequeña, casi como un salmo — referencia, no interactivo).
Grid semanal Maker/Manager/Off (7 columnas, una por día). Norte a 90 días
(3 objetivos con progreso). Feed de notas recientes del cerebro (tarjetas
con extracto + tags). Denso pero con aire real entre secciones — usa la
paleta champagne SOLO en los números (streak, XP, progreso).

PANTALLA 2 — Salud (dashboard + navegación a submódulos)
Header con selector de submódulo (Resumen, Nutrición, Ayuno, Entreno,
Progreso, Cuerpo, Sueño, Estiramiento) como tabs horizontales o rail
lateral en desktop. Vista Resumen: anillo o barra de calorías del día
(comido / restante / meta), estado de ayuno activo (timer visual si hay
uno corriendo), última sesión de entreno, último peso registrado — 4
tarjetas tipo "stat" con jerarquía numérica fuerte (el número es lo que se
lee primero). Vista Sueño (la más rica): "deuda de sueño" de los últimos
14 días como número grande con contexto (objetivo, cuánto falta pagar),
gráfica simple de barras de las últimas noches, plan de recuperación en
texto. Esto tiene que sentirse clínico-premium, no como una app de fitness
genérica — nada de verde/rojo semáforo, usa la paleta de marca para
estados (ok = champagne, no verde).

PANTALLA 3 — Finanzas
Header con patrimonio neto como número hero (grande, tipografía Black,
color champagne — es LA cifra de la pantalla). Debajo, 4 stats secundarios
más chicos: total en cuentas, total deudas, por cobrar, neto del mes.
Sección Cuentas: tarjetas por cuenta mostrando tipo (banco/wallet
cripto/exchange/fintech/compartida), moneda, saldo, y estado si está
bloqueada (visual claramente distinto — atenuado, con nota). Sección
Gastos: lista/tabla con filtro por mes y categoría, cada fila muestra
monto original + monto en USD si la moneda difiere (el USD siempre
prominente, el original como dato secundario). Por cobrar/por pagar como
dos columnas o tabs. Todo con densidad de datos real — esto es una tabla
de trabajo, no una landing page, pero con tipografía tabular alineada y
espaciado que no canse la vista en sesiones largas.

PANTALLA 4 — GFIT, reproductor de sesión activa
La pantalla más interactiva del sistema — se usa con el celular en la mano
mientras se entrena, mirándola entre series. Diseño mobile-first, letra
grande, poco que leer por vistazo. Ejercicio actual con nombre grande,
número de serie (ej. "Serie 2 de 3"), campos grandes tipo botón para
peso/reps (fácil de tocar con dedos sudados). Timer de descanso circular
o de barra, muy visible, con el tiempo restante en tipografía Black
enorme. Botón de siguiente serie/ejercicio, grande, ancho completo,
color Ultramarine. Progreso de la sesión como barra fina arriba (qué
tanto del entreno completado). Cero elementos decorativos — todo tiene
que ser legible a 1 metro de distancia sudando.

PANTALLA 5 — Cerebro (grafo de conocimiento)
El módulo más "premium" visualmente — es donde el sistema muestra
profundidad. Grafo de nodos conectados (notas) ocupando la mayoría de la
pantalla, fondo Ink oscuro incluso en modo claro del resto de la app (esta
vista puede romper la regla y sentirse como un planetario/constelación).
Nodos en Royal/Ultra-light, líneas de conexión finas y sutiles, un nodo
resaltado en Ultramarine al hacer hover/tap. Panel lateral (o modal en
móvil) con buscador, filtro de tags (chips), y lista de notas recientes
como tarjetas compactas con extracto de 2 líneas. La sensación debe ser
"estoy viendo el mapa de mi propia mente", no una herramienta de BI.

Para cada pantalla: versión desktop (sidebar + contenido) y versión móvil
(bottom nav de 5 destinos + contenido apilado). Modo claro (Linen) y modo
oscuro (Ink) de las 5.
```

## Prompt 2 — extensión al resto de pantallas

```
Usando exactamente el mismo lenguaje visual, tipografía, íconos y
componentes de las 5 pantallas ancla que ya diseñamos, extiende el sistema
a estas pantallas, reutilizando los mismos patrones de layout donde
aplique (lista con filtros = mismo patrón que Finanzas/Gastos; tablero
kanban = mismo patrón para CRM; timeline = mismo patrón para Diario):

- Tareas (war room: lista agrupada, prioridad visual, subtareas)
- Agenda (calendario + formulario de alta de evento)
- CRM (kanban de pipeline, 6 columnas)
- Hábitos (checklist + racha + nivel, hermano visual del checklist de Home)
- Juego (stats HP/nivel/oro, tienda de recompensas, quests)
- Diario (timeline por día, 5 tipos de entrada con color/ícono distinto)
- Contenido + Redes (pipeline de ideas, editor de borrador)
- Semana (grid de bloques Maker/Manager por función)
- Mi Sistema (pantalla de dispositivos emparejados + QR de pairing)
- Login (pantalla de acceso, minimalista, solo logo + campo de password)

No inventes contenido nuevo — usa placeholders realistas en el mismo tono
que las pantallas ancla (proyectos como BrainTech/Rafik/taskr, no "Project
A/B/C").
```

## Estado

Ninguno de los dos prompts se ha corrido en Stitch todavía. Cuando existan
outputs, traerlos a `design-system/` (o una carpeta `stitch/` hermana) y
actualizar `design.md` con el resultado de íconos y logo, que hoy son los
dos huecos reales del sistema.
