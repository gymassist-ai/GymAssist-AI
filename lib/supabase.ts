import { createClient } from '@supabase/supabase-js';
import { firstRuntimeEnv, getRuntimeEnv } from '@/lib/runtimeEnv';

const supabaseUrl = firstRuntimeEnv(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
const supabaseKey = firstRuntimeEnv([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);
const supabaseAuthKey = firstRuntimeEnv([
  'SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]);

export const hasSupabaseServiceRoleKey = Boolean(getRuntimeEnv('SUPABASE_SERVICE_ROLE_KEY'));
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export const supabaseAuth = supabaseUrl && supabaseAuthKey ? createClient(supabaseUrl, supabaseAuthKey) : supabase;
