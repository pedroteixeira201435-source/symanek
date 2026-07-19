import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { college } from "@/lib/content";
import { PageHero } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ArrowRight, CheckIcon, BriefcaseIcon } from "@/components/icons";

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
          <Reveal delay={220}>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-accent-soft/60 p-4 text-[15px] text-petrol-800">
              <BriefcaseIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>{college.internship}</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Our Values */}
      <section className="container-max py-20">
        <Reveal><span className="eyebrow">Our Values</span></Reveal>
        <Reveal delay={60}>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold">What we stand for</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {college.values.map((v, i) => (
            <Reveal key={v.title} delay={(i % 3) * 70}>
              <div className="card h-full p-7">
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-petrol-600">{v.body}</p>
              </div>
            </Reveal>
          ))}
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

      {/* Our Team */}
      <section className="bg-petrol-50/60 py-20">
        <div className="container-max grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card ring-1 ring-petrol-100">
              <Image src="/images/team/staff.jpg" alt="The Symanek Specialized College team" fill sizes="(max-width:1024px) 90vw, 520px" className="object-cover" />
            </div>
          </Reveal>
          <div>
            <Reveal><span className="eyebrow">Our Team</span></Reveal>
            <Reveal delay={60}>
              <h2 className="mt-4 text-3xl font-semibold">Experienced facilitators who care</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 text-[15px] leading-relaxed text-petrol-600">
                Our dedicated team of facilitators and staff brings real industry experience and a
                supportive, student-first approach — guiding you from application through to graduation
                and into your career.
              </p>
            </Reveal>
          </div>
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
