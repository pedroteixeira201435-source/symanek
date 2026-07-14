import type { Metadata } from "next";
import { college } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with Symanek Specialized College — ${college.contact.address}.`,
};

export default function ContactPage() {
  const items = [
    { label: "Visit us", value: college.contact.address },
    { label: "Call us", value: college.contact.phones.join(" · ") },
    { label: "Email us", value: college.contact.emails.join(" · ") },
    { label: "Office hours", value: college.contact.hours },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="We'd love to hear from you"
        subtitle="Questions about programmes, admissions or fees? Reach out and our team will get back to you."
      />

      <div className="container-max grid gap-12 py-16 lg:grid-cols-2">
        <div className="space-y-6">
          {items.map((it, i) => (
            <Reveal key={it.label} delay={i * 60}>
              <div className="rounded-2xl border border-petrol-100 p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-petrol-400">{it.label}</div>
                <div className="mt-2 text-[15px] font-medium text-petrol-800">{it.value}</div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={240}>
            <div className="flex gap-3">
              <a href={college.contact.facebook} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-md">Facebook</a>
              <a href={college.contact.instagram} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-md">Instagram</a>
              <a href={college.contact.maps} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-md">Open in Maps</a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div className="card p-7">
            <h2 className="text-lg font-semibold">Send us a message</h2>
            <p className="mt-1 text-sm text-petrol-500">We usually reply within one business day.</p>
            <ContactForm className="mt-6" />
          </div>
        </Reveal>
      </div>
    </>
  );
}
