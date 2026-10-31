import { createClient } from '@supabase/supabase-js'

// Personal fork: points at our own Supabase project (schema: scripts/sql/personal-schema.sql).
// Set these in frontend/.env.local for dev and in the hosting provider for builds.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see frontend/.env.example)')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
