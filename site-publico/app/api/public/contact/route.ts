import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit, verifyTurnstile } from "@/lib/public-security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "contact", 10, 60 * 60 * 1000); if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body || !supabaseAdmin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const human = await verifyTurnstile(body.turnstileToken, req); if (!human.ok) return NextResponse.json({ error: human.error }, { status: 400 });
  const { name, email, subject, message } = body;
  if (![name, email, subject, message].every((v) => typeof v === "string" && v.trim())) return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  const { error } = await supabaseAdmin.rpc("submit_contact", { p_name: name.trim(), p_email: email.trim(), p_subject: subject.trim(), p_message: message.trim() });
  if (error) return NextResponse.json({ error: "Could not send message." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
