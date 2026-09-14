"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/form";
import { submitApplication } from "@/lib/api";
import { categories } from "@/lib/content";
import { CheckIcon, ArrowRight } from "@/components/icons";

// Namibia grading — must mirror the API route (app/api/public/application/route.ts).
// SYMBOLS is keyed by the per-subject result level; LEVEL_MAP maps the applicant's
// highest school level to the result level used for symbols/validation.
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
const SCHOOL_LEVELS: { value: string; label: string }[] = [
  { value: "grade_11_nssco", label: "Grade 11 / NSSCO" },
  { value: "grade_12_nsscas", label: "Grade 12 / NSSCAS" },
  { value: "nssc_higher", label: "NSSC Higher" },
  { value: "other", label: "Other / equivalent" },
];

type SubjectRow = { subject: string; level: string; symbol: string };

const MAX_MB = 10;
function fileError(file: File | null, label: string): string | null {
  if (!file) return null;
  if (file.size > MAX_MB * 1024 * 1024) return `${label} must be ${MAX_MB} MB or smaller.`;
  return null;
}

export function ApplyForm({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [schoolLevel, setSchoolLevel] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [identityDocument, setIdentityDocument] = useState<File | null>(null);
  const [certificateDocument, setCertificateDocument] = useState<File | null>(null);
  const [optionalDocuments, setOptionalDocuments] = useState<File[]>([]);

  const resultLevel = LEVEL_MAP[schoolLevel] || "other";
  const englishSymbols = SYMBOLS[resultLevel];

  function addSubject() {
    setSubjects((rows) => [...rows, { subject: "", level: resultLevel, symbol: "" }]);
  }
  function updateSubject(i: number, patch: Partial<SubjectRow>) {
    setSubjects((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeSubject(i: number) {
    setSubjects((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    if (!identityDocument) return setError("Please upload your ID or passport.");
    if (!certificateDocument) return setError("Please upload your Grade 11/12 certificate or statement.");
    const localFileError =
      fileError(identityDocument, "Identity document") ||
      fileError(certificateDocument, "Certificate") ||
      optionalDocuments.map((f) => fileError(f, "Supporting document")).find(Boolean);
    if (localFileError) return setError(localFileError);

    // Keep only completed subject rows; the API auto-adds English from englishSymbol
    // when no English subject is present, so partial rows can be safely dropped.
    const academicResults = subjects
      .filter((r) => r.subject.trim() && r.symbol)
      .map((r) => ({
        subject: r.subject.trim(),
        level: r.level,
        symbol: r.symbol,
        isEnglish: r.subject.trim().toLowerCase().includes("english"),
      }));

    setPending(true);
    try {
      const res = await submitApplication({
        fullName: String(fd.get("fullName")),
        email: String(fd.get("email")),
        phone: String(fd.get("phone")),
        programmeSlug: String(fd.get("programme")),
        mode: String(fd.get("mode")),
        message: String(fd.get("message") ?? ""),
        highestSchoolLevel: schoolLevel,
        schoolName: String(fd.get("schoolName")),
        yearCompleted: Number(fd.get("yearCompleted")),
        englishSymbol: String(fd.get("englishSymbol")),
        academicResults,
        identityDocument,
        certificateDocument,
        optionalDocuments,
      });
      setAppId(res.applicationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't submit your application. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (appId) {
    return (
      <div className={`rounded-2xl bg-accent-soft p-8 text-center ${className}`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
          <CheckIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Application received</h3>
        <p className="mt-1 text-sm text-petrol-600">
          Your tracking ID is <span className="font-semibold text-petrol-900">{appId}</span>.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-petrol-600">
          Our admissions team will review your application and documents. Once approved, you&apos;ll receive
          a unique reference code and an approval letter you can download from the Student Portal — then
          pay your fees by EFT using that reference.
        </p>
        <Link href="/portal" className="btn btn-primary btn-md mt-6">
          Track my application <ArrowRight />
        </Link>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <form onSubmit={onSubmit} className={`space-y-6 ${className}`}>
      {/* Personal details */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required><Input name="fullName" required autoComplete="name" placeholder="e.g. Maria Shikongo" /></Field>
          <Field label="Phone" required><Input name="phone" required autoComplete="tel" placeholder="+264 …" /></Field>
        </div>
        <Field label="Email" required><Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></Field>
        <Field label="Programme" required>
          <Select name="programme" required defaultValue="">
            <option value="" disabled>Select a programme…</option>
            {categories.map((c) => (
              <optgroup key={c.slug} label={c.title}>
                {c.programmes.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}{p.level ? ` (${p.level})` : ""}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Preferred study mode" required>
          <Select name="mode" required defaultValue="">
            <option value="" disabled>Select…</option>
            <option>Full-Time</option>
            <option>Distance Learning</option>
          </Select>
        </Field>
      </div>

      {/* Academic background & documents */}
      <div className="space-y-4 rounded-2xl border border-petrol-100 p-5">
        <div>
          <h3 className="text-base font-semibold text-petrol-900">Academic background &amp; documents</h3>
          <p className="mt-1 text-sm text-petrol-500">Tell us your highest school results and upload your documents.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Highest school level" required>
            <Select name="highestSchoolLevel" required value={schoolLevel} onChange={(e) => setSchoolLevel(e.target.value)}>
              <option value="" disabled>Select…</option>
              {SCHOOL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
          <Field label="School name" required><Input name="schoolName" required placeholder="e.g. Windhoek High School" /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year completed" required>
            <Input name="yearCompleted" type="number" required min={1950} max={currentYear + 1} placeholder={String(currentYear)} />
          </Field>
          <Field label="English symbol" required hint="Your grade for English at the level above.">
            <Select name="englishSymbol" required defaultValue="" disabled={!schoolLevel}>
              <option value="" disabled>{schoolLevel ? "Select…" : "Select a school level first"}</option>
              {englishSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {/* Dynamic subject results */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-petrol-700">Subject results <span className="text-petrol-400">(optional but recommended)</span></span>
            <button type="button" onClick={addSubject} disabled={!schoolLevel} className="btn btn-ghost btn-sm disabled:opacity-50">Add subject</button>
          </div>
          {!schoolLevel && <p className="text-xs text-petrol-400">Select a school level to add subjects.</p>}
          {subjects.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_110px_auto]">
              <Input aria-label="Subject" placeholder="Subject (e.g. Mathematics)" value={row.subject} onChange={(e) => updateSubject(i, { subject: e.target.value })} />
              <Select aria-label="Level" value={row.level} onChange={(e) => updateSubject(i, { level: e.target.value, symbol: "" })}>
                {SCHOOL_LEVELS.map((l) => <option key={l.value} value={LEVEL_MAP[l.value]}>{l.label}</option>)}
              </Select>
              <Select aria-label="Symbol" value={row.symbol} onChange={(e) => updateSubject(i, { symbol: e.target.value })}>
                <option value="" disabled>Symbol…</option>
                {(SYMBOLS[row.level] || SYMBOLS.other).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <button type="button" onClick={() => removeSubject(i)} className="btn btn-ghost btn-sm text-red-600" aria-label="Remove subject">Remove</button>
            </div>
          ))}
        </div>

        {/* Required documents */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FileField label="ID / passport" required file={identityDocument} onPick={setIdentityDocument} />
          <FileField label="Grade 11/12 certificate or statement" required file={certificateDocument} onPick={setCertificateDocument} />
        </div>

        {/* Optional documents */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-petrol-700">
            Other supporting documents <span className="text-petrol-400">(optional)</span>
          </span>
          <span className="flex items-center gap-3 rounded-xl border border-petrol-200 bg-white px-3 py-2">
            <span className="shrink-0 rounded-lg bg-petrol-100 px-3 py-1.5 text-sm font-medium text-petrol-700">Choose files</span>
            <span className="truncate text-sm text-petrol-500">
              {optionalDocuments.length === 0 ? "No files chosen" : optionalDocuments.map((f) => f.name).join(", ")}
            </span>
          </span>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setOptionalDocuments(Array.from(e.target.files ?? []))}
            className="sr-only"
          />
          <span className="mt-1 block text-xs text-petrol-400">Proof of residence, previous qualifications, etc. PDF/JPG/PNG/WebP, up to {MAX_MB} MB each.</span>
        </label>
      </div>

      <Field label="Anything you'd like us to know?" hint="Optional">
        <Textarea name="message" rows={3} placeholder="Questions or extra context for admissions." />
      </Field>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <SubmitButton pending={pending}>Submit application</SubmitButton>
      <p className="text-center text-xs text-petrol-400">
        By applying you agree to be contacted about your admission.
      </p>
    </form>
  );
}

// Custom file control so the button/hint text stays English regardless of the
// browser's locale (the native <input type=file> chrome is not translatable).
function FileField({ label, required, file, onPick }: { label: string; required?: boolean; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-petrol-700">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      <span className="flex items-center gap-3 rounded-xl border border-petrol-200 bg-white px-3 py-2">
        <span className="shrink-0 rounded-lg bg-petrol-100 px-3 py-1.5 text-sm font-medium text-petrol-700">Choose file</span>
        <span className="truncate text-sm text-petrol-500">{file ? file.name : "No file chosen"}</span>
      </span>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </label>
  );
}
