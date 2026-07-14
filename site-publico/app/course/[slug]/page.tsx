import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { allProgrammes, programmeBySlug, formatN } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { ArrowRight, CheckIcon, ClockIcon, BriefcaseIcon } from "@/components/icons";

export function generateStaticParams() {
  return allProgrammes.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = programmeBySlug(params.slug);
  if (!p) return {};
  return { title: p.name, description: p.description };
}

export default function CoursePage({ params }: { params: { slug: string } }) {
  const p = programmeBySlug(params.slug);
  if (!p) notFound();

  const facts = [
    ["Duration", p.duration],
    ["Level", p.level ?? "—"],
    ["Study modes", p.modes ?? "—"],
    ["Tuition", p.fee ? formatN(p.fee) : "Enquire"],
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-petrol-950 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="container-max relative py-14 sm:py-16">
          <Reveal>
            <Link href={`/programmes/${p.category}`} className="inline-flex items-center gap-1.5 text-sm text-petrol-300 transition-colors hover:text-white">
              <ArrowRight className="rotate-180" /> {p.categoryTitle}
            </Link>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold sm:text-[2.6rem]">{p.name}</h1>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/apply" className="btn btn-accent btn-lg">Apply for this programme <ArrowRight /></Link>
              <Link href="/contact" className="btn btn-ghost btn-lg bg-white/10 text-white ring-white/20 hover:bg-white/15">Ask a question</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="container-max grid gap-12 py-16 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <Reveal>
            <div>
              <h2 className="text-xl font-semibold">About this programme</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-petrol-600">{p.description}</p>
            </div>
          </Reveal>

          {p.requirements && (
            <Reveal>
              <div>
                <h2 className="text-xl font-semibold">Entry requirements</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-petrol-600">{p.requirements}</p>
              </div>
            </Reveal>
          )}

          {p.careers && p.careers.length > 0 && (
            <Reveal>
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <BriefcaseIcon className="text-accent" /> Career paths
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.careers.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[15px] text-petrol-700">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
        </div>

        {/* Sticky facts card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-petrol-500">
              <ClockIcon className="h-4 w-4" /> At a glance
            </h3>
            <dl className="mt-4 divide-y divide-petrol-100">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-sm text-petrol-500">{k}</dt>
                  <dd className="max-w-[60%] text-right text-sm font-medium text-petrol-900">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/apply" className="btn btn-primary btn-md mt-5 w-full">Apply Now</Link>
            <p className="mt-3 text-center text-xs text-petrol-400">
              Fees payable by EFT using your student reference after approval.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
