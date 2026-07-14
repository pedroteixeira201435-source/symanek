import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser/server Supabase client. Null until env vars are set (keeps the app
// runnable in pure mock mode). Wired to the LOCAL stack during development via
// .env.local, then to the cloud project by changing those two vars — nothing else.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true } }) : null;
