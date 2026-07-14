"use client";

import { useState } from "react";
import { Field, Input, SubmitButton } from "@/components/form";
import { lookupApplication, type ApplicationStatus } from "@/lib/api";
import { college, formatN } from "@/lib/content";
import { CheckIcon, ArrowRight } from "@/components/icons";

const STAGES: { key: string; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Payment confirmed" },
  { key: "enrolled", label: "Enrolled" },
];

export function PortalLookup() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplicationStatus | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await lookupApplication(String(fd.get("ref")));
    setResult(res);
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Reference code or email">
            <Input name="ref" required placeholder="e.g. SYM-2026-0042" autoComplete="off" />
          </Field>
        </div>
        <div className="sm:w-40">
          <SubmitButton pending={pending}>Check status</SubmitButton>
        </div>
      </form>
      <p className="mt-2 text-center text-xs text-petrol-400">
        Demo references: <button className="underline" onClick={() => document.querySelector<HTMLInputElement>("input[name=ref]")!.value = "SYM-2026-0042"}>SYM-2026-0042</button>{" "}
        (approved) · <button className="underline" onClick={() => document.querySelector<HTMLInputElement>("input[name=ref]")!.value = "SYM-2026-0043"}>SYM-2026-0043</button> (enrolled)
      </p>

      {result && (
        <div className="mt-8">
          {!result.found ? (
            <div className="rounded-2xl border border-petrol-100 bg-petrol-50/60 p-8 text-center">
              <h3 className="text-lg font-semibold">No application found</h3>
              <p className="mt-1 text-sm text-petrol-600">
                Double-check your reference code, or contact us at {college.contact.emails[0]}.
              </p>
            </div>
          ) : (
            <ResultCard status={result} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ status }: { status: Extract<ApplicationStatus, { found: true }> }) {
  const currentIdx = STAGES.findIndex((s) => s.key === status.stage);
  const approved = currentIdx >= STAGES.findIndex((s) => s.key === "approved");
  const enrolled = status.stage === "enrolled";

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-petrol-100 bg-petrol-50/60 p-6">
        <div className="text-sm text-petrol-500">Applicant</div>
        <div className="text-lg font-semibold">{status.fullName}</div>
        <div className="mt-0.5 text-sm text-petrol-600">{status.programme}</div>
      </div>

      {/* Progress */}
      <div className="p-6">
        <ol className="flex flex-wrap gap-y-3">
          {STAGES.map((s, i) => {
            const reached = i <= currentIdx;
            return (
              <li key={s.key} className="flex items-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${reached ? "bg-accent text-white" : "bg-petrol-100 text-petrol-400"}`}>
                  {reached ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`ml-2 mr-3 text-sm ${reached ? "text-petrol-900" : "text-petrol-400"}`}>{s.label}</span>
                {i < STAGES.length - 1 && <span className={`mr-3 hidden h-px w-6 sm:block ${i < currentIdx ? "bg-accent" : "bg-petrol-200"}`} />}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Approved: reference + EFT + letter */}
      {approved && status.reference && (
        <div className="space-y-5 border-t border-petrol-100 p-6">
          <div className="rounded-2xl bg-petrol-900 p-6 text-white">
            <div className="text-xs font-semibold uppercase tracking-wider text-petrol-300">Your student reference</div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-wide">{status.reference}</div>
            <p className="mt-2 text-sm text-petrol-300">
              Use this exact reference on your EFT so we can match your payment and mark your fees as paid.
            </p>
          </div>

          {!enrolled && status.amountDue ? (
            <div className="rounded-2xl border border-petrol-100 p-5">
              <h4 className="font-semibold">Pay your fees by EFT</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Amount due" v={formatN(status.amountDue)} />
                <Row k="Payment reference" v={status.reference} mono />
                <Row k="Beneficiary" v={college.name} />
              </dl>
              <p className="mt-3 text-xs text-petrol-400">
                Bank details are included in your approval letter. After payment, allow 1–2 business days for confirmation.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <a href={status.approvalLetterUrl ?? "#"} className="btn btn-primary btn-md">
              Download approval letter <ArrowRight />
            </a>
            {enrolled && (
              <a href="https://symanek.educims.org/" target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-md">
                Enter Student Portal <ArrowRight />
              </a>
            )}
          </div>

          {enrolled && (
            <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
              <CheckIcon className="h-4 w-4" /> Payment confirmed — you&apos;re enrolled. Welcome to Symanek!
            </div>
          )}
        </div>
      )}

      {!approved && (
        <div className="border-t border-petrol-100 p-6 text-sm text-petrol-600">
          Your application is being processed. You&apos;ll be able to download your approval letter and see your
          payment reference here as soon as it&apos;s approved.
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-petrol-500">{k}</dt>
      <dd className={`font-medium text-petrol-900 ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}
