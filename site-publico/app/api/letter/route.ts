import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildApprovalLetter } from "@/lib/letter";
import { programmeBySlug } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "approval-letters";

// GET /api/letter?ref=SYM-2026-0044
// Verifies the application is approved, lazily generates the PDF into the private
// bucket on first request, and redirects to a short-lived signed URL.
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select("reference,full_name,programme_slug,amount_due,stage,approval_letter_path")
    .eq("reference", ref)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  if (!app || !["approved", "paid", "enrolled"].includes(app.stage)) {
    return NextResponse.json({ error: "Letter not available" }, { status: 404 });
  }

  const objectPath = (app.approval_letter_path ?? `${BUCKET}/${app.reference}.pdf`).replace(
    new RegExp(`^${BUCKET}/`),
    ""
  );

  const sign = () => supabaseAdmin!.storage.from(BUCKET).createSignedUrl(objectPath, 300);

  let signed = await sign();
  if (signed.error || !signed.data) {
    const pdf = await buildApprovalLetter({
      reference: app.reference as string,
      fullName: app.full_name,
      programme: programmeBySlug(app.programme_slug)?.name ?? app.programme_slug,
      amountDue: Number(app.amount_due ?? 0),
    });
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) return NextResponse.json({ error: "Could not create letter" }, { status: 500 });
    signed = await sign();
  }

  if (signed.error || !signed.data) {
    return NextResponse.json({ error: "Could not sign letter" }, { status: 500 });
  }
  return NextResponse.redirect(signed.data.signedUrl);
}
