# Contrato de escrituras Brain, fase 1

`src/lib/brain-write.ts` replica el contrato de Cortex para no aceptar memoria o paginas sin destino, evidencia, tags del registro, dedupe y contexto de tenant estampado por servidor. No esta conectado aun a las rutas existentes de Pancho OS.

Taski mantiene sus sesiones en Taski. No debe copiar transcripciones completas a GBrain. Solo una memoria extraida y validada con `target: 'memory'`, `evidence.source: 'taski'` y una referencia de sesion o mensaje puede cruzar despues por el futuro escritor validado.

La futura herramienta GBrain debe validar tenant o fuente autorizada en el servidor, deduplicar y devolver una referencia remota antes de marcar una reserva como escrita. No usar `put_page` directo desde una transcripcion o una ruta de chat.

Relacionado: [[cortex-canon]] [[arquitectura-agentes-hermes-gbrain]]
