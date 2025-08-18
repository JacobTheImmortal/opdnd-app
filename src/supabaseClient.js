import { createClient } from '@supabase/supabase-js';

/** Reads and cleans env values */
function cleanEnvString(v) {
  if (v == null) return '';
  // Remove non-printable / zero-width characters
  const cleaned = String(v)
    .replace(/[^\x20-\x7E]/g, '')   // strip non-ASCII printables (incl. zero-width)
    .trim();
  return cleaned;
}

const rawUrl = cleanEnvString(import.meta.env.VITE_SUPABASE_URL);
const rawKey = cleanEnvString(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Helpful debug: print the exact char codes if something weird sneaks in.
const debugWithCodes = (label, s) =>
  console.log(label, s, 'length:', s.length, 'codes:', Array.from(s).map(c => c.charCodeAt(0)));

debugWithCodes('🧪 Raw Supabase URL:', rawUrl);
debugWithCodes('🧪 Raw Supabase Key (first 6):', rawKey.slice(0, 6) + '…');

// Normalize URL: remove trailing slash(es)
const supabaseUrl = rawUrl.replace(/\/+$/, '');
const supabaseAnonKey = rawKey;

// Validate URL shape strictly
const SUPABASE_HOST_RE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
if (!supabaseUrl || !SUPABASE_HOST_RE.test(supabaseUrl)) {
  throw new Error(
    `❌ Invalid VITE_SUPABASE_URL. Got "${supabaseUrl}". ` +
    `Expected exactly "https://<project>.supabase.co" (no trailing slash/whitespace).`
  );
}
if (!supabaseAnonKey) {
  throw new Error('❌ VITE_SUPABASE_ANON_KEY missing.');
}

// Optional: quick health check to surface DNS/blocked egress early in console
try {
  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' })
    .then(r => console.log('🔎 Supabase health:', r.ok ? 'OK' : `HTTP ${r.status}`))
    .catch(err => console.warn('⚠️ Supabase health check failed:', err?.message || err));
} catch (e) {
  console.warn('⚠️ Health check threw:', e?.message || e);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
