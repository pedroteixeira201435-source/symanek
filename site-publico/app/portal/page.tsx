import type { Metadata } from "next";
import { PageHero } from "@/components/ui";
import { PortalLookup } from "@/components/portal-lookup";

export const metadata: Metadata = {
  title: "Student Portal",
  description: "Track your application, download your approval letter and get your EFT payment reference.",
};

export default function PortalPage() {
  return (
    <>
      <PageHero
        eyebrow="Student Portal"
        title="Track your admission"
        subtitle="Enter your reference code (or the email you applied with) to see your status, download your approval letter and get your EFT payment reference."
      />
      <div className="container-max py-16">
        <PortalLookup />
      </div>
    </>
  );
}
