import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ApplyForm } from "@/components/apply-form";

export const metadata: Metadata = {
  title: "Apply Online",
  description: "Apply to Symanek Specialized College. Submit your application online and track your admission.",
};

const steps = [
  ["Submit", "Complete this form and we receive your application instantly."],
  ["Approval", "Admissions reviews your application. Approved applicants get a unique reference code."],
  ["Pay by EFT", "Use your reference code as the payment reference so we can match your EFT."],
  ["Enrol", "Once payment is confirmed, your Student Portal unlocks."],
];

export default function ApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="Apply online"
        subtitle="It takes just a few minutes. After you apply, track your status any time from the Student Portal."
      />

      <div className="container-max grid gap-12 py-16 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-petrol-400">How it works</h2>
          {steps.map(([title, body], i) => (
            <Reveal key={title} delay={i * 60}>
              <div className="flex gap-4 rounded-2xl border border-petrol-100 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol-700 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <p className="mt-0.5 text-sm text-petrol-600">{body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </aside>

        <Reveal delay={80}>
          <div className="card p-7 sm:p-8">
            <h2 className="text-xl font-semibold">Application form</h2>
            <p className="mt-1 text-sm text-petrol-500">Fields marked with <span className="text-accent">*</span> are required.</p>
            <ApplyForm className="mt-6" />
          </div>
        </Reveal>
      </div>
    </>
  );
}
