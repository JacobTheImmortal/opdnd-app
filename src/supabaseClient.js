import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("🧪 Raw Supabase URL:", rawUrl, "Type:", typeof rawUrl);
console.log("🧪 Raw Supabase Key:", rawKey, "Type:", typeof rawKey);

if (!rawUrl || !rawKey) {
  throw new Error("❌ Supabase credentials are missing or malformed.");
}

const supabaseUrl = String(rawUrl).trim();
const supabaseAnonKey = String(rawKey).trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
