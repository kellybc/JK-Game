import { createClient } from '@supabase/supabase-js';

// Access environment variables safely via the defined process.env from vite.config
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Only create the client if keys are present
// If not (local mode), this remains null and the app will still work in offline mode.
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isSupabaseConfigured = () => !!supabase;