# Stitch — módulos Ikigai y Networking Room (25-ago-2026)

Correr en el MISMO proyecto de Stitch que ya tiene Ultramarine v5 (no abrir proyecto
nuevo — reusa paleta, tipografía e íconos ya generados). Un solo prompt, 5 pantallas.

## Prompt

```
Usando exactamente el mismo sistema visual Ultramarine v5 de las pantallas ya
generadas (paleta, tipografía Gotham/Montserrat, sistema de íconos, sidebar), diseña
5 pantallas nuevas para dos módulos nuevos del OS: Red (mapeo de contactos personales)
e Ikigai (propósito). Ambos son módulos INDEPENDIENTES entre sí — no comparten datos,
solo el lenguaje visual.

CONTEXTO DE PRODUCTO
Estos dos módulos también se van a vender por separado como add-ons en Nerio (otro
producto), así que cada uno debe sentirse completo y autocontenido, no una sub-sección
de algo más grande.

═══════════════════════════════════════
MÓDULO NETWORKING ROOM — networking personal, no CRM de ventas
═══════════════════════════════════════

Marco de referencia: metodología real de Leader Network Diagnostic (Phil Willburn) +
tipos de vínculo de Ibarra & Hunter. Nunca lo llames "CRM" ni uses lenguaje de ventas
(leads, pipeline, deals) — es red personal, no comercial.

PANTALLA 1 — Diagnóstico de Networking Room (captura)
Formulario/tarjetas para agregar hasta 16 personas. Por persona: nombre o iniciales,
selector de "área" como chips libres (ej: Trabajo, Universidad, Familia, Comunidad —
el usuario puede crear chips nuevos), un control visual de cercanía de 3 anillos
concéntricos (como una diana, no un dropdown — tap en el anillo que corresponde), y
3 opciones de tipo de vínculo presentadas como tarjetas seleccionables con ícono
propio: Operacional (ayuda a ejecutar), Personal (sostiene), Estratégico (abre
puertas). Debajo de la lista de personas cargadas: una vista donde se ven como puntos
dispersos y se puede tocar dos puntos para trazar una línea entre ellos (marca que se
conocen entre sí). Mobile-first, esto se llena desde el celular.

PANTALLA 2 — Mapa de Networking Room (grafo, la pantalla ancla del módulo)
Grafo de nodos ocupando la mayoría de la pantalla, fondo Ink oscuro (mismo tratamiento
que le diste al grafo de Cerebro). Cada persona es un punto coloreado por tipo de
vínculo (3 colores distintos, usa la paleta de marca, nunca semáforo rojo/verde),
agrupados espacialmente en clusters por área. Tamaño del punto proporcional a
cercanía. Líneas finas y sutiles entre personas conectadas. Panel lateral (o modal en
móvil) con filtro por área y por tipo de vínculo, y buscador de persona.

PANTALLA 3 — Scorecard de Networking Room
Panel de resultado, no un grafo. Elemento principal: una escala horizontal de 6
posiciones (Muy abierta — Abierta — IDEAL — Algo cerrada — Cerrada — Muy cerrada) con
un indicador marcando dónde cae el usuario. IMPORTANTE: el "ideal" está en el CENTRO
de la escala, no en un extremo — el diseño debe comunicar visualmente que ni muy
abierta ni muy cerrada es buena, sin que se sienta como una mala nota. Debajo: un
bloque de "diversidad" (qué tan repartida está la Networking Room entre áreas, puede ser barras
o un anillo por área) y un bloque de "balance de vínculos" (proporción
operacional/personal/estratégico) con una nota de alerta suave si el estratégico está
muy bajo.

PANTALLA 4 — Plan de Networking Room
Formulario simple, no denso. Un campo grande para la meta ("¿qué quieres lograr con tu
red en los próximos meses?"), un campo destacado y con tratamiento visual distinto
para "la frontera a cruzar" (algo que hoy no cruzas y quieres cruzar — dale peso
visual, es el corazón emocional del módulo), y una lista de personas objetivo elegidas
del mapa, cada una con un campo de táctica concreta en texto libre.

═══════════════════════════════════════
MÓDULO IKIGAI — propósito, versionable
═══════════════════════════════════════

PANTALLA 5 — Mapa Ikigai + Zonas y cobertura (una sola pantalla, dos secciones)
Arriba: el diagrama clásico de 4 círculos superpuestos (Lo que amo / En lo que soy
bueno / Por lo que me pagan / Lo que el mundo necesita), cada círculo con frases
cortas tipo post-it distribuidas dentro, algunas en las intersecciones. Nombra las
intersecciones sutilmente (Pasión, Misión, Profesión, Vocación) y el centro donde se
cruzan los 4 (Ikigai). Que se vea como un diagrama premium, no un Venn de PowerPoint —
usa la paleta de marca para diferenciar cada círculo con transparencia donde se
superponen.
Abajo, en la misma pantalla: una lista de "zonas de vida" (ej: tarjetas con nombre de
proyecto/área — BrainTech, CODEIS, Familia) cada una mostrando chips de qué círculos
satisface. Si algún círculo de arriba no tiene ninguna zona sirviéndolo, marca eso
visualmente como un hueco (sin alarmismo, un tono sutil de atención).

Para las 5 pantallas: versión desktop (sidebar + contenido) y versión móvil (bottom
nav + contenido apilado). Modo claro y oscuro de las 5. No inventes datos de ejemplo
genéricos tipo "John Doe" — usa nombres ficticios pero plausibles en español, y para
Ikigai usa zonas de vida creíbles para un founder (ej: "Mi empresa", "Familia",
"Comunidad", "Proyecto personal").
```

## Después de correr esto

Igual que las rondas anteriores: traer el export (zip), extraer a
`design-system/stitch-v3/`, revisar las capturas contra lo pedido, y decidir si se
porta a componentes reales o si primero pasa por otra ronda de correcciones.
