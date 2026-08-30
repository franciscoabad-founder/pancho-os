import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;
export function setClienteSupabaseFinanzasInbox(fn: (() => SupabaseClient) | null): void { clienteActual = fn ?? getSupabaseServer; }
export const ESTADOS_INBOX = ['pendiente', 'procesado', 'descartado'] as const;
export async function listarFinanzasInbox(estado?: string): Promise<unknown[]> {
  let q = clienteActual().from('finanzas_inbox').select('*').order('created_at', { ascending: false });
  if (estado && ESTADOS_INBOX.includes(estado as typeof ESTADOS_INBOX[number])) q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function crearFinanzasInbox(body: { origen?: string; remitente?: string; asunto?: string; contenido?: string; adjuntos?: unknown; datos_extraidos?: unknown }): Promise<unknown> {
  if (!body.contenido?.trim()) throw new Error('contenido requerido');
  const { data, error } = await clienteActual().from('finanzas_inbox').insert([{ origen: body.origen?.trim() || 'email', remitente: body.remitente?.trim() || null, asunto: body.asunto?.trim() || null, contenido: body.contenido.trim(), adjuntos: Array.isArray(body.adjuntos) ? body.adjuntos : [], datos_extraidos: body.datos_extraidos && typeof body.datos_extraidos === 'object' ? body.datos_extraidos : {} }]).select().single();
  if (error) throw error;
  return data;
}
export async function actualizarFinanzasInbox(id: string, body: { estado?: string; datos_extraidos?: unknown }): Promise<unknown> {
  if (body.estado !== undefined && !ESTADOS_INBOX.includes(body.estado as typeof ESTADOS_INBOX[number])) throw new Error('estado invalido');
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.estado !== undefined) update.estado = body.estado;
  if (body.datos_extraidos !== undefined) update.datos_extraidos = body.datos_extraidos;
  const { data, error } = await clienteActual().from('finanzas_inbox').update(update).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
