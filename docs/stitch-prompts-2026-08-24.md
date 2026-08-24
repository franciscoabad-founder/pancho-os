# Stitch — siguiente tanda completa (24-ago-2026)

Todo lo que falta, en dos prompts. Corre el 1 primero (corrige las 5
pantallas ancla en el mismo proyecto de Stitch), después el 2 (extiende al
resto). No abras un proyecto nuevo — sigue en el mismo, así el ícono set y
los componentes ya generados se reusan en vez de reinventarse.

## Prompt 1 — correcciones a las 5 pantallas ancla

```
Corrige estas 3 cosas en las 5 pantallas que ya generaste, manteniendo
exactamente el mismo sistema visual, íconos y layout — son correcciones de
contenido, no un rediseño:

1. IDIOMA: la pantalla de Cerebro tiene texto en inglés ("Feynman Technique
   Application", "Q3 Revenue Projections", "Query Knowledge Base...",
   "Active Node", "Expand Note", "Recent Synapses", "Central thesis of the
   Pancho OS methodology"). Todo el copy de producto es en español. Tradúcelo
   manteniendo el tono directo y ejecutivo, sin emojis, sin guion largo.

2. DATOS DE EJEMPLO REALES — reemplaza los genéricos por estos:

   Finanzas: las cuentas no son "Cold Wallet"/"Exchange Staking" genéricas.
   Las cuentas reales son: Metamask (wallet cripto), Binance (exchange),
   Wise (fintech multimoneda), Takenos (fintech), UglyCash (fintech
   cripto/USD), una cuenta compartida con la mamá del usuario (label
   "Cuenta con Mamá", tipo compartida), y un banco en Ecuador que está
   BLOQUEADO (saldo 0, con una nota corta visible tipo "Bloqueada — trámite
   legal en curso", visualmente atenuada/distinta de las cuentas activas).
   La moneda base es USD, no MXN — los montos de ejemplo en otra moneda
   (si los hay) deben mostrar el monto original Y su conversión a USD.

   Salud / Sueño: el modelo real de "deuda de sueño" es una ventana móvil
   de 14 días donde dormir de más SÍ paga deuda (no es un contador que solo
   sube), con un tope de 2.5 noches de necesidad estimada (para este
   usuario, necesidad ≈ 9h45min/noche, tope ≈ 24h). El widget debe
   comunicar: deuda actual en horas, la necesidad estimada por noche, el
   promedio real de las últimas 14 noches, y cuántas noches al objetivo
   faltan — no solo un número de horas suelto sin ese contexto.

3. FECHAS: usa fechas de 2026 en los ejemplos (el sistema opera en agosto
   2026), no 2023/abril viejas.

No toques layout, íconos, tipografía ni paleta — solo el copy y los datos
de ejemplo de las 5 pantallas ya generadas.
```

## Prompt 2 — extensión al resto de pantallas

```
Usando exactamente el mismo lenguaje visual, tipografía, sistema de
íconos (el del sidebar: Hoy, Salud, Finanzas, GFIT, Cerebro) y componentes
de las 5 pantallas ancla ya corregidas, extiende el sistema a estas
pantallas. Reutiliza patrones de layout donde aplique: lista con filtros =
mismo patrón que Finanzas/Registro Operativo; tablero kanban = patrón
nuevo solo para CRM; timeline = patrón nuevo para Diario.

- **Tareas** — war room: lista agrupada por proyecto, prioridad visual
  (Low/Medium/High/Critical como pills de color), subtareas colapsables,
  fecha límite, contador "N abiertas de M".
- **Agenda** — calendario semanal/mensual + formulario de alta de evento
  (título, fecha, hora, descripción).
- **CRM** — kanban de pipeline con 6 columnas (Nuevo, Prospecto, Contacto,
  Propuesta, Negociación, Cerrado), tarjetas de lead con nombre y valor.
- **Hábitos** — checklist de 7 hábitos con su ancla conductual en texto
  secundario, racha en días, nivel y XP (mismo patrón visual que el
  checklist de Hoy, pero como pantalla completa).
- **Juego** — HP (barra), nivel, oro, tienda de recompensas (tarjetas con
  costo en oro), quests de la semana (lista con progreso).
- **Diario** — timeline vertical agrupado por día, 5 tipos de entrada
  (Día/Proceso/Decisión/Win/Idea) cada uno con su propio color/ícono sutil,
  caja de captura rápida arriba con selector de tipo.
- **Contenido + Redes** — pipeline de ideas en columnas por etapa, editor
  de borrador de post (título, cuerpo, plataforma, estado).
- **Semana** — grid de 7 días x bloques de función (Promover/Vender/
  Construir/Entregar), cada bloque muestra el modo del día (Maker/Manager/
  Off) y barra de progreso de horas vs objetivo semanal.
- **Mi Sistema** — pantalla de dispositivos emparejados: tabla con
  dispositivo, tipo, último uso, estado, botón revocar; más un flujo de
  emparejamiento nuevo con código corto o QR.
- **Login** — minimalista: solo el wordmark ("FRANCISCO" en ExtraLight +
  "ABAD" en Black, color Ultramarine, sin foto ni logo genérico) centrado
  sobre fondo Ink, campo de contraseña, botón "Entrar al OS".

Para el sidebar en todas: usa el wordmark tipográfico real (no una foto de
perfil genérica) hasta que exista un logo real.

No inventes contenido nuevo fuera de lo especificado — usa placeholders
realistas en el mismo tono que las 5 pantallas ancla (proyectos como
BrainTech/Rafik/taskr, no "Project A/B/C"; fechas de agosto 2026).
```

## Después de correr esto

Trae el export nuevo (zip) y lo integro igual que el anterior: extraigo a
`design-system/stitch/`, reviso las capturas contra el sistema real y
actualizo `design.md` con lo que de verdad salió, no lo que se pidió.
