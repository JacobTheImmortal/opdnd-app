// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// -- Sanitize helpers: remove wrapping quotes and stray whitespace
function clean(val) {
  return String(val || '')
    .replace(/^[\'\"\u201C\u201D]+|[\'\"\u201C\u201D]+$/g, '') // strip "smart"/plain quotes
    .trim();
}

const RAW_URL = clean(import.meta.env.VITE_SUPABASE_URL);
const RAW_KEY = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Extra safety: allow Vercel envs without VITE_ prefix if you added them there by mistake
const SUPABASE_URL = RAW_URL || clean(import.meta.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_KEY = RAW_KEY || clean(import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Validate URL early so we fail loudly & clearly in dev/prod
let parsedUrl = null;
try {
  parsedUrl = new URL(SUPABASE_URL);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('❌ Supabase URL is invalid after cleaning:', JSON.stringify(SUPABASE_URL));
  throw e;
}

// Friendly diagnostics in console
(function debugLog() {
  try {
    const keyPreview = SUPABASE_KEY ? SUPABASE_KEY.slice(0, 6) : '(empty)';
    // eslint-disable-next-line no-console
    console.log('%cRaw Supabase URL (cleaned):', 'color:#0aa', SUPABASE_URL, 'len:', SUPABASE_URL.length);
    // eslint-disable-next-line no-console
    console.log('%cRaw Supabase Key (first 6):', 'color:#0aa', keyPreview);
  } catch {}
})();

// Do a lightweight health check in dev/prod (non-blocking)
(async () => {
  try {
    const res = await fetch(`${parsedUrl.origin}/auth/v1/health`, { mode: 'cors' });
    // eslint-disable-next-line no-console
    console.log('%cSupabase health:', 'color:#0a0', res.ok ? 'OK' : `Bad (${res.status})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('⚠️ Supabase health check failed:', err?.message || err);
  }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});