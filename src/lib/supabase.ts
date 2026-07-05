import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseConfig';

const supabaseConfig = getSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = supabaseConfig.isConfigured;
export const supabaseUrl = supabaseConfig.url;

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
