import { createClient } from '@supabase/supabase-js';

const browserEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const nodeEnv = typeof process !== 'undefined' ? process.env : undefined;

const supabaseUrl =
	browserEnv?.VITE_SUPABASE_URL ??
	nodeEnv?.SUPABASE_URL ??
	nodeEnv?.VITE_SUPABASE_URL ??
	null;

const supabaseKey =
	browserEnv?.VITE_SUPABASE_ANON_KEY ??
	nodeEnv?.SUPABASE_SERVICE_ROLE_KEY ??
	nodeEnv?.SUPABASE_KEY ??
	nodeEnv?.SUPABASE_ANON_KEY ??
	nodeEnv?.VITE_SUPABASE_ANON_KEY ??
	null;

if (!supabaseUrl) {
	console.warn('Supabase URL missing. Set SUPABASE_URL / VITE_SUPABASE_URL in your environment.');
}

if (!supabaseKey) {
	console.warn('Supabase key missing. Set SUPABASE_SERVICE_ROLE_KEY (server) or VITE_SUPABASE_ANON_KEY (client).');
}

const client = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const supabase = client;
export default client;
