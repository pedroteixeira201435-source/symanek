"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { categories } from "@/lib/content";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/programmes", label: "Programmes", mega: true },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out-strong ${
        scrolled
          ? "bg-white/80 shadow-glass backdrop-blur-xl backdrop-saturate-150"
          : "bg-white/0"
      }`}
    >
      <div className="container-max flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Symanek home">
          <Image
            src="/images/logo.png"
            alt="Symanek Specialized College"
            width={44}
            height={44}
            className="h-10 w-auto"
            priority
          />
          <span className="hidden text-[15px] font-semibold leading-tight text-petrol-900 sm:block">
            Symanek
            <span className="block text-[11px] font-medium tracking-wide text-petrol-500">
              Specialized College
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                  pathname === item.href
                    ? "text-petrol-900"
                    : "text-petrol-600 hover:text-petrol-900"
                }`}
              >
                {item.label}
              </Link>
              {item.mega && (
                <div className="invisible absolute left-1/2 top-full w-72 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,transform] duration-200 ease-out-strong group-hover:visible group-hover:opacity-100 [transform:translate(-50%,4px)] group-hover:[transform:translate(-50%,0)]">
                  <div className="rounded-2xl bg-white p-2 shadow-card-hover ring-1 ring-petrol-100">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/programmes/${c.slug}`}
                        className="block rounded-xl px-3 py-2 text-sm text-petrol-700 transition-colors hover:bg-petrol-50 hover:text-petrol-900"
                      >
                        {c.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/portal" className="btn btn-ghost btn-md">
            Student Portal
          </Link>
          <Link href="/apply" className="btn btn-accent btn-md">
            Apply Now
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="btn btn-ghost h-10 w-10 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        className={`overflow-hidden border-t border-petrol-100 bg-white/95 backdrop-blur-xl md:hidden ${
          open ? "max-h-[70vh]" : "max-h-0"
        } transition-[max-height] duration-300 ease-drawer`}
      >
        <div className="container-max flex flex-col gap-1 py-3">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-petrol-700 hover:bg-petrol-50">
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <Link href="/portal" className="btn btn-ghost btn-md flex-1">Student Portal</Link>
            <Link href="/apply" className="btn btn-accent btn-md flex-1">Apply Now</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
