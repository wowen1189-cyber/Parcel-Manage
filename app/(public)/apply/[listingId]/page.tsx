import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { AUTHORIZATION, sectionsFor } from "@/lib/application-form";
import { money } from "@/lib/format";
import { unitName } from "@/lib/leasing";
import { feeText, publicCompany, publishedListings } from "@/lib/public-leasing";
import { ApplicationForm } from "../application-form";

export const metadata = { title: "Rental application" };

export default async function ApplyPage({ params }: PageProps<"/apply/[listingId]">) {
  const { listingId } = await params;
  const company = await publicCompany();
  if (!company) notFound();
  const l = (await publishedListings(company.id)).find((x) => x.id === listingId);
  if (!l) notFound();
  const kind = l.unit.kind === "commercial" ? "commercial" : "residential";
  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Logo companyName={company.name} />
      </div>
      <h1 className="text-[28px] font-extrabold leading-tight">{kind === "commercial" ? "Commercial rental application" : "Rental application"}</h1>
      <p className="mt-1 mb-8 text-[16px] text-muted">
        {unitName(l.unit)} · {money(l.rent_cents)}/month
      </p>
      <ApplicationForm mode="listing" hidden={{ listing_id: l.id }} sections={sectionsFor(kind, "applicant")} defaults={{}} inviteOthers={kind === "residential"} feeText={feeText(company.settings, "applicant", Boolean(company.stripe_charges_enabled))} authorization={AUTHORIZATION} />
    </main>
  );
}
