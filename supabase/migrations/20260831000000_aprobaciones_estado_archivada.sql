-- Permitir el estado 'archivada' en os_aprobaciones. El CHECK viejo solo
-- aceptaba pendiente/aprobado/rechazado, por eso el auto-archivado fallaba.
-- Aditiva e idempotente.

alter table os_aprobaciones drop constraint if exists os_aprobaciones_estado_check;
alter table os_aprobaciones add constraint os_aprobaciones_estado_check
  check (estado in ('pendiente', 'aprobado', 'rechazado', 'archivada'));
