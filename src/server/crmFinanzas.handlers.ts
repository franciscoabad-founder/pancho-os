import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;
export function setClienteSupabaseCrmFinanzas(fn: (() => SupabaseClient) | null): void { clienteActual = fn ?? getSupabaseServer; }

export async function registrarIngresoDesdeLead(leadId: string, fechaEsperada?: string): Promise<{ ingreso: unknown; creado: boolean }> {
  if (!leadId?.trim()) throw new Error('lead_id requerido');
  const sb = clienteActual();
  const { data: lead, error: leadError } = await sb.from('crm_leads').select('id,nombre,empresa,proyecto,etapa,valor').eq('id', leadId).single();
  if (leadError) throw leadError;
  if (lead.etapa !== 'cerrado') throw new Error('solo se puede registrar un lead cerrado');
  const monto = Number(lead.valor);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('el lead cerrado debe tener valor positivo');
  const marca = `crm_lead:${lead.id}`;
  const { data: existente, error: existenteError } = await sb.from('por_cobrar').select('*').ilike('notas', `%${marca}%`).limit(1).maybeSingle();
  if (existenteError) throw existenteError;
  if (existente) return { ingreso: existente, creado: false };
  const { data: ingreso, error } = await sb.from('por_cobrar').insert([{ cliente: lead.empresa || lead.nombre, proyecto: lead.proyecto || null, monto, moneda: 'USD', estado: 'aplicando', fecha_esperada: fechaEsperada || null, notas: `${marca} · generado desde CRM` }]).select().single();
  if (error) throw error;
  return { ingreso, creado: true };
}
