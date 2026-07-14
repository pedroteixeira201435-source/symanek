import Link from "next/link";
import Image from "next/image";
import { college, categories } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-petrol-100 bg-petrol-950 text-petrol-100">
      <div className="container-max grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={40} height={40} className="h-10 w-auto brightness-0 invert" />
            <span className="text-[15px] font-semibold text-white">
              Symanek
              <span className="block text-[11px] font-medium text-petrol-300">Specialized College</span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-petrol-300">{college.intro}</p>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-petrol-400">Programmes</h3>
          <ul className="space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/programmes/${c.slug}`} className="text-petrol-300 transition-colors hover:text-white">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-petrol-400">Explore</h3>
          <ul className="space-y-2.5 text-sm">
            {[
              ["/about", "About Us"],
              ["/apply", "Apply Now"],
              ["/portal", "Student Portal"],
              ["/gallery", "Gallery"],
              ["/contact", "Contact Us"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-petrol-300 transition-colors hover:text-white">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-petrol-400">Contact</h3>
          <ul className="space-y-2.5 text-sm text-petrol-300">
            <li>{college.contact.address}</li>
            {college.contact.phones.map((p) => (
              <li key={p}>
                <a href={`tel:${p.replace(/\s/g, "")}`} className="transition-colors hover:text-white">{p}</a>
              </li>
            ))}
            {college.contact.emails.map((e) => (
              <li key={e}>
                <a href={`mailto:${e}`} className="transition-colors hover:text-white">{e}</a>
              </li>
            ))}
            <li className="pt-1 text-petrol-400">{college.contact.hours}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-max flex flex-col items-center justify-between gap-3 py-6 text-xs text-petrol-400 sm:flex-row">
          <p>© {new Date().getFullYear()} {college.name}. All rights reserved.</p>
          <div className="flex gap-5">
            <a href={college.contact.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white">Facebook</a>
            <a href={college.contact.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
