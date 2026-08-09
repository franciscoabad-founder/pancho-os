import type { DatosFinanzas } from './types';

export const datosFinanzas: DatosFinanzas = {
  mes: 'Junio 2026',
  ingresos_total: 18400,
  gastos_total: 7200,
  balance: 11200,
  transacciones: [
    { id: 'f1', descripcion: 'Retainer BrainTech — MegaRetail', monto: 5000, tipo: 'ingreso', categoria: 'Consultoria', proyecto: 'BrainTech', fecha: '2026-06-01' },
    { id: 'f2', descripcion: 'Retainer BrainTech — cliente fintech', monto: 6000, tipo: 'ingreso', categoria: 'Consultoria', proyecto: 'BrainTech', fecha: '2026-06-05' },
    { id: 'f3', descripcion: 'Proyecto Rafik — estrategia Q2', monto: 4800, tipo: 'ingreso', categoria: 'Consultoria', proyecto: 'Rafik', fecha: '2026-06-10' },
    { id: 'f4', descripcion: 'Kit IA para finanzas — ventas', monto: 2600, tipo: 'ingreso', categoria: 'Producto digital', fecha: '2026-06-15' },
    { id: 'f5', descripcion: 'Servidor VPS automations', monto: 90, tipo: 'gasto', categoria: 'Infraestructura', fecha: '2026-06-01' },
    { id: 'f6', descripcion: 'Herramientas SaaS (n8n, Resend, Vercel)', monto: 180, tipo: 'gasto', categoria: 'Software', fecha: '2026-06-05' },
    { id: 'f7', descripcion: 'Subcontratacion diseno taskr', monto: 2400, tipo: 'gasto', categoria: 'Equipo', proyecto: 'taskr', fecha: '2026-06-10' },
    { id: 'f8', descripcion: 'Publicidad LinkedIn — Kit IA', monto: 800, tipo: 'gasto', categoria: 'Marketing', fecha: '2026-06-15' },
    { id: 'f9', descripcion: 'Honorarios legales', monto: 600, tipo: 'gasto', categoria: 'Legal', fecha: '2026-06-18' },
    { id: 'f10', descripcion: 'Coworking mensual', monto: 350, tipo: 'gasto', categoria: 'Oficina', fecha: '2026-06-01' },
    { id: 'f11', descripcion: 'Capacitacion y libros', monto: 280, tipo: 'gasto', categoria: 'Desarrollo', fecha: '2026-06-20' },
    { id: 'f12', descripcion: 'Varios operativos', monto: 500, tipo: 'gasto', categoria: 'Varios', fecha: '2026-06-22' },
  ],
  metas: [
    { label: 'Ingresos mensuales', actual: 18400, meta: 20000, unidad: 'USD' },
    { label: 'Margen neto', actual: 61, meta: 65, unidad: '%' },
    { label: 'Gastos fijos', actual: 1220, meta: 1500, unidad: 'USD' },
    { label: 'Ahorro mensual', actual: 5000, meta: 6000, unidad: 'USD' },
  ],
};
