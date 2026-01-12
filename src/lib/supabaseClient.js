import { createClient } from '@supabase/supabase-js';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const nodeEnv = typeof process !== 'undefined' ? process.env : undefined;
const supabaseUrl = browserEnv?.VITE_SUPABASE_URL ?? nodeEnv?.SUPABASE_URL;

// Prefer the browser-friendly Vite env var, but allow Node usage via process.env fallback.
const browserKey = browserEnv?.VITE_SUPABASE_ANON_KEY;
const nodeKey = nodeEnv?.SUPABASE_KEY;
const supabaseKey = browserKey ?? nodeKey;

if (!supabaseUrl) {
  console.warn('Supabase URL missing. Set VITE_SUPABASE_URL (and SUPABASE_URL for Node) in .env.');
}

if (!supabaseKey) {
  console.warn(
    'Supabase key missing. Add VITE_SUPABASE_ANON_KEY to .env (or SUPABASE_KEY in Node) to enable saving.',
  );
}

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
