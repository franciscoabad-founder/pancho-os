// Logica pura de leads del CRM (tabla `crm_leads`).
//
// Extraida de src/pages/api/leads.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.
//
// Contrato sensible: el MCP expone crm_listar_leads y crm_crear_lead contra
// /api/leads (ver src/mcp/osTools.ts), asi que las claves de respuesta
// (`leads`, `lead`) y la validacion de `nombre` se conservan literales.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseLeads(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface LeadInput {
  nombre?: string;
  empresa?: string;
  proyecto?: string;
  etapa?: string;
  probabilidad?: unknown;
  scoring?: unknown;
  valor?: unknown;
  etiquetas?: unknown;
  notas?: unknown;
}

export async function listarLeads(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('crm_leads').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearLead(body: LeadInput): Promise<unknown> {
  if (!body.nombre?.trim()) throw new Error('nombre requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('crm_leads')
    .insert([{
      nombre: body.nombre.trim(),
      empresa: body.empresa?.trim() || null,
      proyecto: body.proyecto?.trim() || null,
      etapa: body.etapa ?? 'nuevo',
      probabilidad: Number(body.probabilidad) || 0,
      scoring: Number(body.scoring) || 0,
      valor: Number(body.valor) || 0,
      etiquetas: body.etiquetas ?? [],
      notas: body.notas ?? null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarLead(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  const { data, error } = await sb.from('crm_leads').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarLead(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('crm_leads').delete().eq('id', id);
  if (error) throw error;
}
