import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "payment-proofs";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const OK_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

// POST /api/payment-proof  (multipart: ref, amount, file)
// Applicant uploads their EFT proof of payment. Server-side (service role):
// validate the application is approved, store the file, record it. An admin then
// reviews and marks the fees paid (mark_paid) — no payment gateway.
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  const form = await req.formData();
  const ref = String(form.get("ref") ?? "").trim();
  const amount = Number(form.get("amount") ?? 0);
  const file = form.get("file");

  // Note: the `File` global is not available on Node 18 — duck-type on Blob.
  if (!ref) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!amount || amount <= 0) return NextResponse.json({ error: "Enter the amount paid" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  if (file.type && !OK_TYPES.includes(file.type))
    return NextResponse.json({ error: "Use an image or PDF" }, { status: 400 });

  const fileName = (file as { name?: string }).name ?? "proof";

  const { data: app } = await supabaseAdmin
    .from("applications")
    .select("id,reference,stage")
    .or(`reference.eq.${ref},email.eq.${ref.toLowerCase()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app || !["approved", "paid"].includes(app.stage)) {
    return NextResponse.json({ error: "Application not found or not yet approved" }, { status: 404 });
  }

  const ext = (fileName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${app.reference}/${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (up.error) return NextResponse.json({ error: "Upload failed" }, { status: 500 });

  const { error } = await supabaseAdmin
    .from("applications")
    .update({ proof_path: path, proof_amount: amount, proof_submitted_at: new Date().toISOString() })
    .eq("id", app.id);
  if (error) return NextResponse.json({ error: "Could not record proof" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
