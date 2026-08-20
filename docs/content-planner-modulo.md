# Planificador de contenido

Este modulo guarda el metodo de la semana de contenido: **escuchar, dar forma, publicar, aprender**. Sirve para convertir una frase real de la audiencia en una semana chica que se puede reutilizar. Vive en la logica del sistema (`src/lib/contenido/`), en seis tablas de la base de datos y en la pantalla `/os/contenido/planner` (el Desk semanal).

El panel actual de Contenido (ideas, formato, plataformas) sigue igual. Este modulo es el planificador semanal. No lo reemplaza.

## El loop de la semana

Cuatro bloques de 5 minutos:

1. **Escuchar.** Anotas la frase exacta que oiste: una pregunta, una objecion o una respuesta. Eso es una **senal**.
2. **Dar forma.** Eliges una senal fuerte y defines **una historia padre**: una promesa util y un trabajo claro.
3. **Publicar.** Te comprometes con **como maximo 3 piezas** (la padre y hasta 2 cortes). Cada pieza tiene una proxima accion fisica, no "seguir redactando".
4. **Aprender.** Revisas una pieza ya publicada y dejas un veredicto: **reusar, ajustar o retirar**.

Regla dura de la semana: **una historia padre y maximo 3 piezas**. La capacidad es una decision, no un deseo.

## Las 6 piezas del sistema

### 1. Senales (`contenido_signals`)

Lenguaje exacto de la audiencia. No es un tema abstracto. Es lo que alguien dijo.

- Palabras exactas, fuente, momento de la audiencia, tension
- Fuerza del 1 al 5 (4 o 5 = vale la pena usarla)
- Estado: nueva, lista, en uso, archivada

### 2. Campanas (`contenido_campaigns`)

El marco de varias semanas: objetivo, oferta, promesa, llamado a la accion, indicador y meta.

### 3. Semanas (`contenido_weekly_sprints`)

Una semana real. Anotas cuantas piezas puedes hacer de verdad y cual es el foco.

- Capacidad restante = capacidad menos piezas planeadas (nunca baja de 0)
- Ese numero se calcula. No se guarda a mano.

### 4. Historias (`contenido_stories`)

Cada pieza de contenido. Puede ser padre (la historia de la semana) o derivada (un corte con otro trabajo).

Etapas, en orden:

1. Brief (borrador)
2. Shaping (dandole forma)
3. Ready (lista)
4. Scheduled (agendada)
5. Live (publicada)

Se puede avanzar de una en una. Ready puede pasar a Scheduled o directo a Live. Se puede volver un paso para rehacer. Live no se mueve.

Una historia esta **atrasada** si su fecha de publicacion ya paso y todavia no esta Live.

### 5. Pruebas y archivos (`contenido_proof_assets`)

Evidencia, citas, graficos, notas. Siempre con **estado de derechos** antes de usar una cita o un recorte de terceros. No se guardan contrasenas ni datos de pago.

### 6. Resultados (`contenido_results`)

Lo que paso despues de publicar: indicador, numeros, frases que la audiencia repitio, y el veredicto.

- **Reusar:** el angulo funciona. Sigue sacando cortes.
- **Ajustar:** el nucleo sirve, cambia el gancho, la prueba o el formato.
- **Retirar:** deja de repetir este angulo.

Un resultado esta **listo para decidir** cuando ya tiene veredicto. La cola de reuso son los resultados marcados Reusar, o los que tienen una cola de reuso escrita.

## Como se conectan

```
Senal --> Historia <-- Campana
              |
              +-- Semana
              +-- Historia padre (si es un corte)
              +-- Prueba / archivo
              +-- Resultado
```

Una semana puede apuntar a una campana. Una historia apunta a senal, campana y semana. Un corte apunta a su historia padre.

## Lo que este modulo todavia no hace

- No habla con Notion. El kit original era para Notion; aqui las reglas viven en codigo y en tablas.
- No escribe en GBrain ni en el MCP. Eso puede venir despues (Fase 2: mineria de PanchoAtlas como senales).
- La publicacion automatica (Postiz/Hermes) no esta conectada todavia (Fase 3).

## Pantalla y API

- Desk semanal: `/os/contenido/planner` (enlazado desde la pestaña Contenido).
- Agregado del Desk: `GET /api/os/contenido/planner/desk`.
- CRUD por entidad: `/api/os/contenido/planner/{signals|campaigns|sprints|stories|assets|results}`.
- Reglas en servidor: la asignacion de historias al sprint valida 1 padre + maximo 3 piezas (409 si se viola); las etapas solo avanzan por la maquina de estados; una senal usada en una historia pasa a `in_use` automaticamente.

## Donde esta el codigo

- Tipos y reglas: `src/lib/contenido/` (incluye `planner.ts`: validacion y regla semanal)
- Tablas: `supabase/migrations/20260815000100_contenido_planner.sql` (idempotente, con `set search_path = public`)
- API: `src/pages/api/os/contenido/planner/`
- UI: `src/os/components/contenido/OSContentPlanner.tsx`
- Pruebas: `npm run test:contenido`
