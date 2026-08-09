export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { sistemaDefault } from '../../os/data/sistema';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import type { SistemaState } from '../../os/data/types';

const STATE_KEY = 'main';

async function notifySystemWebhook(state: SistemaState) {
  const webhook = import.meta.env.OS_SYSTEM_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'os-system', state, ts: new Date().toISOString() }),
    });
  } catch {
    // El OS no debe fallar si n8n esta temporalmente abajo.
  }
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);

  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_system_state')
      .select('state, updated_at, onboarding_completed, onboarding_answers')
      .eq('key', STATE_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data?.state) {
      return json({
        state: sistemaDefault,
        source: 'default',
        onboarding_completed: data?.onboarding_completed ?? false,
        onboarding_answers: data?.onboarding_answers ?? {},
      });
    }

    return json({
      state: data.state,
      source: 'supabase',
      updated_at: data.updated_at,
      onboarding_completed: data.onboarding_completed ?? false,
      onboarding_answers: data.onboarding_answers ?? {},
    });
  } catch (err) {
    return json({
      state: sistemaDefault,
      source: 'fallback',
      onboarding_completed: false,
      onboarding_answers: {},
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const PUT: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, any>;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'JSON invalido' }, 400);
  }

  // PUT solo de onboarding (sin state): actualiza los flags y nada mas.
  if (!body.state && ('onboarding_completed' in body || 'onboarding_answers' in body)) {
    try {
      const sb = getSupabaseServer();
      const patch: Record<string, unknown> = { key: STATE_KEY, updated_at: new Date().toISOString() };
      if ('onboarding_completed' in body) patch.onboarding_completed = body.onboarding_completed === true;
      if ('onboarding_answers' in body) patch.onboarding_answers = body.onboarding_answers ?? {};

      const { data: existente, error: exError } = await sb
        .from('os_system_state')
        .select('key, state')
        .eq('key', STATE_KEY)
        .maybeSingle();
      if (exError) throw exError;
      if (!existente) patch.state = sistemaDefault;

      const { data, error } = await sb
        .from('os_system_state')
        .upsert(patch, { onConflict: 'key' })
        .select('onboarding_completed, onboarding_answers, updated_at')
        .single();
      if (error) throw error;
      return json({
        ok: true,
        onboarding_completed: data.onboarding_completed,
        onboarding_answers: data.onboarding_answers,
        updated_at: data.updated_at,
      });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  const state: SistemaState = body.state;

  if (!state || !Array.isArray(state.objetivos_90d) || !Array.isArray(state.priority_stack)) {
    return json({ error: 'estado invalido' }, 400);
  }

  const nextState = {
    ...state,
    version: 1,
    updated_at: new Date().toISOString(),
  };

  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_system_state')
      .upsert({
        key: STATE_KEY,
        state: nextState,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
      .select('state, updated_at')
      .single();

    if (error) throw error;
    await notifySystemWebhook(data.state as SistemaState);
    return json({ ok: true, state: data.state, updated_at: data.updated_at });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err), state: nextState }, 502);
  }
};
