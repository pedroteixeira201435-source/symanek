import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { college } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ArrowRight, CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About Us",
  description: college.whyChooseUs,
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        title="A registered vocational & healthcare training institution"
        subtitle={`${college.intro} Located in ${college.location}.`}
      />

      <section className="container-max grid items-center gap-12 py-20 lg:grid-cols-2">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card ring-1 ring-petrol-100">
            <Image src="/images/gallery/campus-1.jpg" alt="Symanek Specialized College" fill sizes="(max-width:1024px) 90vw, 520px" className="object-cover" />
          </div>
        </Reveal>
        <div>
          <Reveal><span className="eyebrow">Why choose us</span></Reveal>
          <Reveal delay={60}>
            <h2 className="mt-4 text-3xl font-semibold">Education that opens doors</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 text-[15px] leading-relaxed text-petrol-600">{college.whyChooseUs}</p>
          </Reveal>
          <Reveal delay={180}>
            <ul className="mt-6 space-y-3">
              {college.accreditations.map((a) => (
                <li key={a} className="flex items-start gap-3 text-[15px] text-petrol-700">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  {a}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-petrol-50/60 py-20">
        <div className="container-max grid gap-8 md:grid-cols-2">
          <Reveal>
            <div className="card h-full p-8">
              <span className="eyebrow">Our Mission</span>
              <p className="mt-4 text-lg leading-relaxed text-petrol-700">{college.mission}</p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="card h-full p-8">
              <span className="eyebrow">Our Vision</span>
              <p className="mt-4 text-lg leading-relaxed text-petrol-700">{college.vision}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-max py-20 text-center">
        <Reveal>
          <h2 className="text-3xl font-semibold">Begin your journey with Symanek</h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/apply" className="btn btn-accent btn-lg">Apply Now <ArrowRight /></Link>
            <Link href="/programmes" className="btn btn-ghost btn-lg">Explore Programmes</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
