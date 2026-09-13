import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
    console.warn('[Warning] SUPABASE_URL missing. Supabase features will be disabled.');
}

if (!supabaseServiceKey && !supabaseKey) {
    console.warn('[Warning] No Supabase key found (SUPABASE_SERVICE_KEY or SUPABASE_KEY).');
}

// Anon/public client — for general reads (respects RLS)
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Service role client — for backend operations (bypasses RLS & statement timeouts)
// NEVER expose this client to the frontend
export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    : supabase; // fallback to anon if service key not set

