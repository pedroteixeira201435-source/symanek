import type { Metadata } from "next";
import Link from "next/link";
import { categories } from "@/lib/content";
import { PageHero, ProgrammeCard } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { categoryIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Programmes",
  description:
    "Explore Symanek Specialized College's accredited degrees, TVET qualifications and short courses in health, safety, care and business.",
};

export default function ProgrammesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Programmes"
        title="Accredited training for real careers"
        subtitle="Degrees, TVET qualifications and short courses across healthcare, occupational safety, care and business — full-time or by distance learning."
      />

      <div className="container-max space-y-20 py-20">
        {categories.map((c) => (
          <section key={c.slug} id={c.slug} className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petrol-100 text-petrol-700">
                  {categoryIcon(c.slug)}
                </div>
                <div>
                  <Reveal>
                    <h2 className="text-2xl font-semibold sm:text-3xl">{c.title}</h2>
                  </Reveal>
                  <Reveal delay={50}>
                    <p className="mt-1 max-w-2xl text-[15px] text-petrol-600">{c.blurb}</p>
                  </Reveal>
                </div>
              </div>
              <Link href={`/programmes/${c.slug}`} className="btn btn-ghost btn-md">
                View category <ArrowRight />
              </Link>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.programmes.map((p, i) => (
                <Reveal key={p.slug} delay={(i % 3) * 60}>
                  <ProgrammeCard programme={p} />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
