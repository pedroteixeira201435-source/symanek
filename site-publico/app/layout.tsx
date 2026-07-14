import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { college } from "@/lib/content";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://symanekacademy.com"),
  title: {
    default: `${college.name} — ${college.slogan}`,
    template: `%s · ${college.name}`,
  },
  description: college.intro,
  openGraph: {
    title: `${college.name} — ${college.slogan}`,
    description: college.intro,
    locale: "en_NA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-petrol-900 antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
