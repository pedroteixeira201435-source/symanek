import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ArrowRight } from "@/components/icons";
import { formatN, type Programme } from "@/lib/content";

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-petrol-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-petrol-500/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="container-max relative py-16 sm:py-20">
        <Reveal><span className="eyebrow bg-white/10 text-accent-soft">{eyebrow}</span></Reveal>
        <Reveal delay={60}>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold sm:text-5xl">{title}</h1>
        </Reveal>
        {subtitle && (
          <Reveal delay={120}>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-petrol-200">{subtitle}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export function ProgrammeCard({ programme }: { programme: Programme }) {
  return (
    <Link href={`/course/${programme.slug}`} className="card card-lift group flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-2">
        {programme.level && (
          <span className="rounded-full bg-petrol-100 px-2.5 py-1 text-xs font-semibold text-petrol-700">
            {programme.level}
          </span>
        )}
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
          {programme.duration}
        </span>
      </div>
      <h3 className="mt-4 text-[17px] font-semibold leading-snug">{programme.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-petrol-600 line-clamp-3">
        {programme.description}
      </p>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-petrol-900">
          {programme.fee ? formatN(programme.fee) : "Enquire"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-petrol-700">
          Details
          <ArrowRight className="transition-transform duration-200 ease-out-strong group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
