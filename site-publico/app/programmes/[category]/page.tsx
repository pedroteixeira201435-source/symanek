import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { categories, categoryBySlug } from "@/lib/content";
import { PageHero, ProgrammeCard } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ArrowRight } from "@/components/icons";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const c = categoryBySlug(params.category);
  if (!c) return {};
  return { title: c.title, description: c.blurb };
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = categoryBySlug(params.category);
  if (!category) notFound();

  return (
    <>
      <PageHero eyebrow="Programmes" title={category.title} subtitle={category.blurb} />

      <div className="container-max py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {category.programmes.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 60}>
              <ProgrammeCard programme={p} />
            </Reveal>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-petrol-100 bg-petrol-50/60 p-8 text-center">
          <h2 className="text-xl font-semibold">Not sure which programme fits you?</h2>
          <p className="mx-auto mt-2 max-w-lg text-[15px] text-petrol-600">
            Our admissions team is happy to guide you through entry requirements and study modes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/apply" className="btn btn-accent btn-md">Apply Now <ArrowRight /></Link>
            <Link href="/contact" className="btn btn-ghost btn-md">Contact us</Link>
          </div>
        </div>
      </div>
    </>
  );
}
