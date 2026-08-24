import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/public-security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "application", 5, 60 * 60 * 1000); if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body || !supabaseAdmin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const { fullName, email, phone, programmeSlug, mode, message } = body;
  if (![fullName, email, phone, programmeSlug, mode].every((v) => typeof v === "string" && v.trim())) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("submit_application", { p_full_name: fullName.trim(), p_email: email.trim(), p_phone: phone.trim(), p_programme_slug: programmeSlug.trim(), p_mode: mode.trim(), p_message: typeof message === "string" ? message.trim() || null : null });
  if (error) return NextResponse.json({ error: "Could not submit application." }, { status: 400 });
  return NextResponse.json({ applicationId: String(data) });
}
