// Data-access seam for the public site. Components call these and never touch
// the transport. Two backends behind one interface:
//   - "mock"     : resolves locally (works with no backend at all)
//   - "supabase" : calls the shared Supabase project via server-authoritative RPCs
// Switch with NEXT_PUBLIC_API_MODE. See ../BACKEND.md for the full flow.

import { supabase } from "@/lib/supabase";

export const API_MODE = (process.env.NEXT_PUBLIC_API_MODE ?? "mock") as "mock" | "supabase";
const useSupabase = () => API_MODE === "supabase" && supabase !== null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
export type ApplicationInput = {
  fullName: string;
  email: string;
  phone: string;
  programmeSlug: string;
  mode: string;
  message?: string;
};

export type ApplicationResult = { ok: true; applicationId: string };

export async function submitApplication(input: ApplicationInput): Promise<ApplicationResult> {
  if (useSupabase()) {
    const { data, error } = await supabase!.rpc("submit_application", {
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone: input.phone,
      p_programme_slug: input.programmeSlug,
      p_mode: input.mode,
      p_message: input.message ?? null,
    });
    if (error) throw error;
    return { ok: true, applicationId: String(data) };
  }

  await wait(900);
  const id = "APP-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  if (typeof window !== "undefined") {
    const store = JSON.parse(localStorage.getItem("sym.applications") ?? "[]");
    store.push({ id, ...input, stage: "submitted", at: Date.now() });
    localStorage.setItem("sym.applications", JSON.stringify(store));
  }
  return { ok: true, applicationId: id };
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------
export type ContactInput = { name: string; email: string; subject: string; message: string };

export async function submitContact(input: ContactInput): Promise<{ ok: true }> {
  if (useSupabase()) {
    const { error } = await supabase!.rpc("submit_contact", {
      p_name: input.name,
      p_email: input.email,
      p_subject: input.subject,
      p_message: input.message,
    });
    if (error) throw error;
    return { ok: true };
  }
  await wait(800);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Portal status lookup
// ---------------------------------------------------------------------------
export type ApplicationStatus =
  | { found: false }
  | {
      found: true;
      fullName: string;
      programme: string;
      stage: "submitted" | "under_review" | "approved" | "paid" | "enrolled";
      reference?: string;
      approvalLetterUrl?: string;
      amountDue?: number;
      proofSubmitted?: boolean;
      proofAmount?: number;
    };

const demoStatuses: Record<string, Extract<ApplicationStatus, { found: true }>> = {
  "SYM-2026-0042": {
    found: true,
    fullName: "Gabriel Naruseb",
    programme: "Certificate in Occupational Health and Safety (Level 4)",
    stage: "approved",
    reference: "SYM-2026-0042",
    approvalLetterUrl: "#",
    amountDue: 19670,
  },
  "SYM-2026-0043": {
    found: true,
    fullName: "Maria Shikongo",
    programme: "Certificate in Caregiving",
    stage: "enrolled",
    reference: "SYM-2026-0043",
    approvalLetterUrl: "#",
    amountDue: 0,
  },
};

export async function lookupApplication(refOrEmail: string): Promise<ApplicationStatus> {
  if (useSupabase()) {
    const { data, error } = await supabase!.rpc("get_application_status", {
      p_ref: refOrEmail.trim(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.found) return { found: false };
    return {
      found: true,
      fullName: row.full_name,
      programme: row.programme,
      stage: row.stage,
      reference: row.reference ?? undefined,
      amountDue: row.amount_due != null ? Number(row.amount_due) : undefined,
      approvalLetterUrl: row.reference ? `/api/letter?ref=${encodeURIComponent(row.reference)}` : undefined,
      proofSubmitted: !!row.proof_submitted,
      proofAmount: row.proof_amount != null ? Number(row.proof_amount) : undefined,
    };
  }

  await wait(700);
  return demoStatuses[refOrEmail.trim().toUpperCase()] ?? { found: false };
}

// Applicant uploads their EFT proof of payment (manual payment, no gateway).
export async function submitPaymentProof(
  ref: string,
  file: File,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  if (useSupabase()) {
    const fd = new FormData();
    fd.append("ref", ref);
    fd.append("amount", String(amount));
    fd.append("file", file);
    const res = await fetch("/api/payment-proof", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j.error || "Upload failed" };
    return { ok: true };
  }
  await wait(600);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin — auth + application management (staff/admin only; RLS-enforced)
// ---------------------------------------------------------------------------
export type AdminApplication = {
  id: string;
  reference: string | null;
  fullName: string;
  email: string;
  phone: string;
  programmeSlug: string;
  mode: string;
  stage: "submitted" | "under_review" | "approved" | "rejected" | "paid" | "enrolled";
  amountDue: number;
  createdAt: string;
  proofPath: string | null;
  proofAmount: number | null;
};

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (useSupabase()) {
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    const { data: prof } = await supabase!.from("profiles").select("role").maybeSingle();
    if (!prof || !["admin", "staff"].includes(prof.role)) {
      await supabase!.auth.signOut();
      return { ok: false, error: "This account is not authorised for the admin console." };
    }
    return { ok: true };
  }
  await wait(400);
  return email.trim().toLowerCase() === "admin@symanek.local"
    ? { ok: true }
    : { ok: false, error: "Mock mode — sign in with admin@symanek.local" };
}

export async function signOut(): Promise<void> {
  if (useSupabase()) await supabase!.auth.signOut();
}

export async function currentAdminEmail(): Promise<string | null> {
  if (useSupabase()) {
    const { data } = await supabase!.auth.getUser();
    return data.user?.email ?? null;
  }
  return null;
}

export async function listApplications(): Promise<AdminApplication[]> {
  if (useSupabase()) {
    const { data, error } = await supabase!
      .from("applications")
      .select("id,reference,full_name,email,phone,programme_slug,mode,stage,amount_due,created_at,proof_path,proof_amount")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      reference: r.reference,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      programmeSlug: r.programme_slug,
      mode: r.mode,
      stage: r.stage,
      amountDue: Number(r.amount_due ?? 0),
      createdAt: r.created_at,
      proofPath: r.proof_path ?? null,
      proofAmount: r.proof_amount != null ? Number(r.proof_amount) : null,
    }));
  }
  await wait(400);
  return [
    { id: "m1", reference: null, fullName: "Johanna Amukwa", email: "johanna@example.com", phone: "+264 81 000 0001", programmeSlug: "certificate-caregiving", mode: "full_time", stage: "submitted", amountDue: 0, createdAt: new Date().toISOString(), proofPath: null, proofAmount: null },
    { id: "m2", reference: "SYM-2026-0042", fullName: "Gabriel Naruseb", email: "gabriel@example.com", phone: "+264 81 000 0002", programmeSlug: "certificate-ohs-level-4", mode: "full_time", stage: "approved", amountDue: 19670, createdAt: new Date().toISOString(), proofPath: "SYM-2026-0042/demo.pdf", proofAmount: 19670 },
    { id: "m3", reference: "SYM-2026-0043", fullName: "Maria Shikongo", email: "maria@example.com", phone: "+264 81 000 0003", programmeSlug: "certificate-caregiving", mode: "distance", stage: "enrolled", amountDue: 0, createdAt: new Date().toISOString(), proofPath: null, proofAmount: null },
  ];
}

// Admin: short-lived signed URL to view an uploaded proof of payment.
export async function proofDownloadUrl(path: string): Promise<string | null> {
  if (useSupabase()) {
    const { data } = await supabase!.storage.from("payment-proofs").createSignedUrl(path, 120);
    return data?.signedUrl ?? null;
  }
  return "#";
}

export async function approveApplication(id: string): Promise<string> {
  if (useSupabase()) {
    const { data, error } = await supabase!.rpc("approve_application", { p_app: id });
    if (error) throw error;
    return String(data);
  }
  await wait(400);
  return "SYM-2026-0099";
}

export async function rejectApplication(id: string): Promise<{ ok: boolean; error?: string }> {
  if (useSupabase()) {
    const { error } = await supabase!.from("applications").update({ stage: "rejected" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  await wait(300);
  return { ok: true };
}

export async function markPaid(id: string, amount: number): Promise<string> {
  if (useSupabase()) {
    const { data, error } = await supabase!.rpc("mark_paid", { p_app: id, p_amount: amount });
    if (error) throw error;
    return String(data);
  }
  await wait(400);
  return "SYM-2026-0099";
}
