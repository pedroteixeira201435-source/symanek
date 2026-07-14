import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY service-role client. Never import this into a Client Component.
// Used by route handlers (e.g. /api/letter) to sign private storage URLs and
// generate approval-letter PDFs. Null until server env vars are set.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
