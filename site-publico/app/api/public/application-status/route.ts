import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/public-security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "application-status", 30, 10 * 60 * 1000); if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.ref !== "string" || !body.ref.trim()) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  const { data, error } = await supabaseAdmin.rpc("get_application_status", { p_ref: body.ref.trim() });
  if (error) return NextResponse.json({ error: "Could not check application status." }, { status: 400 });
  return NextResponse.json({ data });
}
