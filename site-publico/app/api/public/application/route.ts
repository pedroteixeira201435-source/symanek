import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rateLimit } from "@/lib/public-security";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
const SYMBOLS: Record<string, string[]> = {
  nssco_grade_11: ["A*", "A", "B", "C", "D", "E", "F", "G", "U"],
  nsscas_grade_12: ["a", "b", "c", "d", "e", "U"],
  nssc_higher: ["1", "2", "3", "4", "U"],
  other: ["A*", "A+", "A", "B", "C", "D", "E", "F", "G", "a", "b", "c", "d", "e", "1", "2", "3", "4", "U"],
};
const LEVEL_MAP: Record<string, string> = {
  grade_11_nssco: "nssco_grade_11",
  grade_12_nsscas: "nsscas_grade_12",
  nssc_higher: "nssc_higher",
  other: "other",
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function fileName(file: File) {
  return (file.name || "document").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
}

function validateFile(file: File) {
  if (file.size > MAX_BYTES) return "Each document must be 10 MB or smaller.";
  if (file.type && !OK_TYPES.includes(file.type)) return "Documents must be PDF, JPG, PNG or WebP.";
  return null;
}

function validateSymbol(level: string, symbol: string) {
  return (SYMBOLS[level] || SYMBOLS.other).includes(symbol);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "application", 5, 60 * 60 * 1000); if (limited) return limited;
  if (!supabaseAdmin) return bad("Server not configured", 500);

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return bad("Please submit the application with the required documents.");
  }

  const form = await req.formData();
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const programmeSlug = String(form.get("programmeSlug") ?? "").trim();
  const mode = String(form.get("mode") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const highestSchoolLevel = String(form.get("highestSchoolLevel") ?? "").trim();
  const schoolName = String(form.get("schoolName") ?? "").trim();
  const yearCompleted = Number(form.get("yearCompleted") ?? 0);
  const englishSymbol = String(form.get("englishSymbol") ?? "").trim();
  const identityDocument = form.get("identityDocument");
  const certificateDocument = form.get("certificateDocument");
  const optionalDocuments = form.getAll("optionalDocuments").filter(isFile);
  const academicResultsRaw = String(form.get("academicResults") ?? "[]");
  const defaultLevel = LEVEL_MAP[highestSchoolLevel] || "other";

  if (![fullName, email, phone, programmeSlug, mode, highestSchoolLevel, schoolName, englishSymbol].every(Boolean)) return bad("Please complete all required fields.");
  if (!Number.isInteger(yearCompleted) || yearCompleted < 1950 || yearCompleted > new Date().getFullYear() + 1) return bad("Enter a valid year completed.");
  if (!validateSymbol(defaultLevel, englishSymbol)) return bad("Select a valid English symbol for the selected school level.");
  if (!isFile(identityDocument)) return bad("Identity document is required.");
  if (!isFile(certificateDocument)) return bad("Grade 11/12 certificate or statement is required.");

  const requiredFileError = [identityDocument, certificateDocument, ...optionalDocuments].map(validateFile).find(Boolean);
  if (requiredFileError) return bad(requiredFileError);

  let academicResults: { subject: string; level: string; symbol: string; isEnglish?: boolean }[];
  try {
    academicResults = JSON.parse(academicResultsRaw);
  } catch {
    return bad("Academic results are invalid.");
  }
  if (!Array.isArray(academicResults)) return bad("Academic results are invalid.");
  const normalizedResults = academicResults
    .map((r) => ({
      subject: String(r.subject || "").trim(),
      level: String(r.level || defaultLevel).trim(),
      symbol: String(r.symbol || "").trim(),
      isEnglish: Boolean(r.isEnglish),
    }))
    .filter((r) => r.subject && r.symbol);
  if (!normalizedResults.some((r) => r.isEnglish || r.subject.toLowerCase().includes("english"))) {
    normalizedResults.unshift({ subject: "English", level: defaultLevel, symbol: englishSymbol, isEnglish: true });
  }
  for (const result of normalizedResults) {
    if (!["nssco_grade_11", "nsscas_grade_12", "nssc_higher", "other"].includes(result.level)) return bad(`Invalid level for ${result.subject}.`);
    if (!validateSymbol(result.level, result.symbol)) return bad(`Invalid symbol for ${result.subject}.`);
  }

  const uploaded: string[] = [];
  const { data, error } = await supabaseAdmin.rpc("submit_application", {
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_programme_slug: programmeSlug,
    p_mode: mode,
    p_message: message || null,
  });
  if (error) return bad("Could not submit application.");
  const applicationId = String(data);

  try {
    const { error: appUpdateError } = await supabaseAdmin
      .from("applications")
      .update({ highest_school_level: highestSchoolLevel, school_name: schoolName, year_completed: yearCompleted, english_symbol: englishSymbol })
      .eq("id", applicationId);
    if (appUpdateError) throw appUpdateError;

    const docs = [
      { category: "identity_document", file: identityDocument },
      { category: "grade_11_or_12_certificate", file: certificateDocument },
      ...optionalDocuments.map((file) => ({ category: "other", file })),
    ];
    const docRows = [];
    for (const doc of docs) {
      const name = fileName(doc.file);
      const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${applicationId}/${doc.category}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bytes = new Uint8Array(await doc.file.arrayBuffer());
      const upload = await supabaseAdmin.storage.from("application-documents").upload(path, bytes, {
        contentType: doc.file.type || "application/octet-stream",
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploaded.push(path);
      docRows.push({
        application_id: applicationId,
        category: doc.category,
        file_name: name,
        file_type: doc.file.type || null,
        file_size: doc.file.size,
        storage_path: path,
      });
    }

    const { error: docsError } = await supabaseAdmin.from("application_documents").insert(docRows);
    if (docsError) throw docsError;

    const { error: resultsError } = await supabaseAdmin.from("application_academic_results").insert(
      normalizedResults.map((r) => ({
        application_id: applicationId,
        subject: r.subject,
        level: r.level,
        symbol: r.symbol,
        is_english: r.isEnglish || r.subject.toLowerCase().includes("english"),
      }))
    );
    if (resultsError) throw resultsError;
  } catch {
    for (const path of uploaded) await supabaseAdmin.storage.from("application-documents").remove([path]).catch(() => null);
    try { await supabaseAdmin.from("applications").delete().eq("id", applicationId); } catch { /* best-effort rollback */ }
    return bad("Could not save application documents or academic results.");
  }

  return NextResponse.json({ applicationId });
}
