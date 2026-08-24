"use client";

import { useState } from "react";
import { Field, Input, Textarea, SubmitButton } from "@/components/form";
import { submitContact } from "@/lib/api";
import { CheckIcon } from "@/components/icons";

export function ContactForm({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      await submitContact({
        name: String(fd.get("name")),
        email: String(fd.get("email")),
        subject: String(fd.get("subject")),
        message: String(fd.get("message")),
      });
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again or email us directly.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className={`flex flex-col items-center rounded-2xl bg-accent-soft p-8 text-center ${className}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
          <CheckIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Message sent</h3>
        <p className="mt-1 text-sm text-petrol-600">Thank you — we&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      <Field label="Full name" required><Input name="name" required autoComplete="name" placeholder="Your name" /></Field>
      <Field label="Email" required><Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></Field>
      <Field label="Subject" required><Input name="subject" required placeholder="How can we help?" /></Field>
      <Field label="Message" required><Textarea name="message" required rows={4} placeholder="Write your message…" /></Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton pending={pending}>Send message</SubmitButton>
    </form>
  );
}
