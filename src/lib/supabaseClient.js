import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://czqywmnordnnnvopeszm.supabase.co';

// Prefer the browser-friendly Vite env var, but allow Node usage via process.env fallback.
const browserKey = typeof import.meta !== 'undefined' ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;
const nodeKey = typeof process !== 'undefined' ? process.env?.SUPABASE_KEY : undefined;
const supabaseKey = browserKey ?? nodeKey;

if (!supabaseKey) {
  console.warn(
    'Supabase key missing. Add VITE_SUPABASE_ANON_KEY to .env (or SUPABASE_KEY in Node) to enable saving.',
  );
}

export const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
