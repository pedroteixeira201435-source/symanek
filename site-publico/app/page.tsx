import Link from "next/link";
import Image from "next/image";
import { college, stats, categories } from "@/lib/content";
import { Reveal } from "@/components/reveal";
import { ArrowRight, CheckIcon, categoryIcon } from "@/components/icons";

const applySteps = [
  { n: "01", title: "Apply online", body: "Complete the online application and upload your documents in minutes." },
  { n: "02", title: "Get approved", body: "Our admissions team reviews your application and approves qualifying candidates." },
  { n: "03", title: "Receive your reference", body: "You get a unique reference code and a downloadable approval letter. Pay your fees by EFT using that reference." },
  { n: "04", title: "Enrol & start", body: "Once your payment is confirmed, your Student Portal unlocks and your journey begins." },
];

export default function Home() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-petrol-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-petrol-500/25 blur-3xl" />
          <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="container-max relative grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <Reveal>
              <span className="eyebrow bg-white/10 text-accent-soft">Registered · NTA · Nursing Council of Namibia</span>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="mt-5 text-4xl font-semibold sm:text-5xl lg:text-[3.4rem]">
                {college.slogan}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-petrol-200">
                {college.intro} Based in Okahandja, Namibia.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/apply" className="btn btn-accent btn-lg">
                  Apply Now <ArrowRight />
                </Link>
                <Link href="/programmes" className="btn btn-ghost btn-lg bg-white/10 text-white ring-white/20 hover:bg-white/15">
                  Explore Programmes
                </Link>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-6 text-sm italic text-petrol-300">“{college.subSlogan}”</p>
            </Reveal>
          </div>

          <Reveal delay={160} className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl ring-1 ring-white/15 shadow-glass">
              <Image
                src="/images/gallery/students-1.jpg"
                alt="Symanek students in training"
                fill
                sizes="(max-width: 1024px) 90vw, 460px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-petrol-950/50 to-transparent" />
            </div>
          </Reveal>
        </div>

        {/* Stats bar */}
        <div className="border-t border-white/10 bg-white/[0.03]">
          <div className="container-max grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 60} className="text-center lg:text-left">
                <div className="text-3xl font-semibold text-white">{s.value}</div>
                <div className="mt-1 text-sm text-petrol-300">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Value props ---------- */}
      <section className="container-max py-20">
        <Reveal><span className="eyebrow">Why Symanek</span></Reveal>
        <Reveal delay={60}>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">
            Industry-focused education that prepares you for real careers.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { title: "Nationally recognised", body: "Qualifications registered with the NTA, Nursing Council of Namibia and recognised with the HPCNA." },
            { title: "Hands-on practical learning", body: "We combine classroom knowledge with real-world experience to prepare you for professional success." },
            { title: "Flexible study modes", body: "Study full-time or by distance learning — programmes designed to fit your life and goals." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="card card-lift h-full p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <CheckIcon />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-petrol-600">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Programme categories ---------- */}
      <section className="bg-petrol-50/60 py-20">
        <div className="container-max">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Reveal><span className="eyebrow">Our Programmes</span></Reveal>
              <Reveal delay={60}>
                <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Find your path</h2>
              </Reveal>
            </div>
            <Reveal delay={120}>
              <Link href="/programmes" className="btn btn-ghost btn-md">
                View all <ArrowRight />
              </Link>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => (
              <Reveal key={c.slug} delay={(i % 3) * 70}>
                <Link href={`/programmes/${c.slug}`} className="card card-lift group flex h-full flex-col p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-petrol-100 text-petrol-700 transition-colors group-hover:bg-petrol-700 group-hover:text-white">
                    {categoryIcon(c.slug)}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{c.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-petrol-600">{c.blurb}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-petrol-700">
                    {c.programmes.length} {c.programmes.length === 1 ? "programme" : "programmes"}
                    <ArrowRight className="transition-transform duration-200 ease-out-strong group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How to apply ---------- */}
      <section className="container-max py-20">
        <Reveal><span className="eyebrow">Admissions</span></Reveal>
        <Reveal delay={60}>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">
            From application to enrolment in four steps
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {applySteps.map((s, i) => (
            <Reveal key={s.n} delay={i * 70}>
              <div className="relative h-full rounded-2xl border border-petrol-100 p-6">
                <div className="text-sm font-semibold text-accent">{s.n}</div>
                <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-petrol-600">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div className="mt-10">
            <Link href="/apply" className="btn btn-primary btn-lg">
              Start your application <ArrowRight />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---------- Mission / Vision ---------- */}
      <section className="bg-petrol-950 py-20 text-white">
        <div className="container-max grid gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10">
              <span className="eyebrow bg-white/10 text-accent-soft">Our Mission</span>
              <p className="mt-5 text-lg leading-relaxed text-petrol-100">{college.mission}</p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10">
              <span className="eyebrow bg-white/10 text-accent-soft">Our Vision</span>
              <p className="mt-5 text-lg leading-relaxed text-petrol-100">{college.vision}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="container-max py-20">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-petrol-700 to-petrol-900 px-8 py-14 text-center text-white sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold sm:text-4xl">
              Ready to shape your future?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-petrol-200">
              Join Symanek Specialized College and gain the practical skills employers are looking for.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/apply" className="btn btn-accent btn-lg">Apply Now <ArrowRight /></Link>
              <Link href="/contact" className="btn btn-ghost btn-lg bg-white/10 text-white ring-white/20 hover:bg-white/15">
                Talk to us
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
