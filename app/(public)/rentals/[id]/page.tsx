import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { bedBath, date, money, oneLineAddress } from "@/lib/format";
import { photoUrls, unitName } from "@/lib/leasing";
import { publicCompany, publishedListings } from "@/lib/public-leasing";
import { createAdminClient } from "@/lib/supabase/admin";
import { InquiryForm } from "../../apply/application-form";

export async function generateMetadata({ params }: PageProps<"/rentals/[id]">) {
  const { id } = await params;
  const company = await publicCompany();
  const l = company ? (await publishedListings(company.id)).find((x) => x.id === id) : null;
  return { title: l ? `${l.headline} · ${money(l.rent_cents)}/month` : "Rental", description: l?.description.slice(0, 160) };
}

export default async function ListingPage({ params }: PageProps<"/rentals/[id]">) {
  const { id } = await params;
  const company = await publicCompany();
  if (!company) notFound();
  const l = (await publishedListings(company.id)).find((x) => x.id === id);
  if (!l) notFound();
  const photos = await photoUrls(createAdminClient(), l.photos);
  const rules = readBusinessRules(company.settings);
  const residential = l.unit.kind !== "commercial";
  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between">
        <Logo companyName={company.name} />
        <Link href="/rentals" className="text-[14px] font-semibold text-accent">
          ← All rentals
        </Link>
      </div>
      {photos.length > 0 && (
        <div className="mb-6 flex snap-x gap-3 overflow-x-auto">
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links
            <img key={src} src={src} alt={`Photo ${i + 1} of ${l.headline}`} className="aspect-[4/3] w-[85%] shrink-0 snap-start rounded-[var(--radius-card)] object-cover sm:w-[60%]" />
          ))}
        </div>
      )}
      <h1 className="text-[30px] font-extrabold leading-tight">{l.headline}</h1>
      <p className="mt-1 text-[16px] text-muted">{oneLineAddress(l.unit.property)}{l.unit.label !== "Home" && l.unit.label !== "House" ? `, ${l.unit.label}` : ""}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[16px]">
        <span className="text-[24px] font-extrabold">{money(l.rent_cents)}/month</span>
        {(!residential || l.unit.beds) && <span>{residential ? bedBath(l.unit.beds, l.unit.baths) : "Commercial space"}</span>}
        {l.unit.sqft && <span>{l.unit.sqft.toLocaleString()} sq ft</span>}
        <span>Available {date(l.available_on, { blank: "now" })}</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/apply/${l.id}`} className={buttonClass("primary")}>
          Apply now
        </Link>
        <a href="#ask" className={buttonClass("secondary")}>
          Ask a question
        </a>
      </div>
      {l.description && <p className="mt-8 whitespace-pre-line text-[17px] leading-relaxed">{l.description}</p>}
      {l.amenities.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {l.amenities.map((a) => (
            <li key={a} className="rounded-full border border-line-strong px-3 py-1.5 text-[14px]">
              {a}
            </li>
          ))}
        </ul>
      )}
      {residential && (
        <section className="mt-8 rounded-[var(--radius-card)] bg-surface-muted p-5 text-[15px]">
          <h2 className="mb-2 text-[18px] font-bold">What we look for</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Household gross income of at least {rules.screening.incomeMultiple}× the monthly rent.</li>
            <li>No eviction in the last {rules.screening.evictionLookbackYears} years{rules.screening.declineIfOwesLandlord ? " and no money owed to a past landlord" : ""}.</li>
            <li>
              No minimum credit score. Deposit is {rules.screening.depositMonthsAtOrAboveTier} month&apos;s rent with a {rules.screening.creditTierScore}+ score, or {rules.screening.depositMonthsBelowTierMin}–{rules.screening.depositMonthsBelowTierMax} months&apos; rent below that.
            </li>
            <li>{l.pets_allowed ? `Pets welcome (up to ${rules.pets.maxPets}), with a ${money(rules.pets.petFeeCents)} pet fee and ${money(rules.pets.petRentPerPetCents)}/month per pet.` : "No pets."} Assistance animals are always welcome and are not pets.</li>
            <li>Every adult applies. {money(rules.fees.applicationFeePerAdultCents)} per adult{rules.fees.adminFeeCents ? `, plus an admin fee of ${money(rules.fees.adminFeeCents)}` : ""}.</li>
          </ul>
        </section>
      )}
      <section id="ask" className="mt-10 scroll-mt-6">
        <h2 className="mb-3 text-[20px] font-bold">Ask about this rental</h2>
        <InquiryForm listingId={l.id} />
      </section>
      <p className="mt-12 text-[13px] text-subtle">{unitName(l.unit)} · {company.name}. Equal housing opportunity.</p>
    </main>
  );
}
