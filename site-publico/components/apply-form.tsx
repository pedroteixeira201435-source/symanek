"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/form";
import { submitApplication } from "@/lib/api";
import { categories } from "@/lib/content";
import { CheckIcon, ArrowRight } from "@/components/icons";

export function ApplyForm({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await submitApplication({
        fullName: String(fd.get("fullName")),
        email: String(fd.get("email")),
        phone: String(fd.get("phone")),
        programmeSlug: String(fd.get("programme")),
        mode: String(fd.get("mode")),
        message: String(fd.get("message") ?? ""),
      });
      setAppId(res.applicationId);
    } catch {
      setError("We couldn't submit your application. Please try again.");
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
          Our admissions team will review your application. Once approved, you&apos;ll receive a
          unique reference code and an approval letter you can download from the Student Portal —
          then pay your fees by EFT using that reference.
        </p>
        <Link href="/portal" className="btn btn-primary btn-md mt-6">
          Track my application <ArrowRight />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
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
      <Field label="Anything you'd like us to know?" hint="Optional">
        <Textarea name="message" rows={3} placeholder="Previous qualifications, questions, etc." />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton pending={pending}>Submit application</SubmitButton>
      <p className="text-center text-xs text-petrol-400">
        By applying you agree to be contacted about your admission.
      </p>
    </form>
  );
}
