import { createClient } from '@supabase/supabase-js';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase env vars.');
}
