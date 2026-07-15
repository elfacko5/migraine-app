import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sync is opt-in: without env vars configured, the app falls back to
// localStorage-only (see src/hooks/useAttacks.ts). This lets the same build
// run for users who never sign in.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
