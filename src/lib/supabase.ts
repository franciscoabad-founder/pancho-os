import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
