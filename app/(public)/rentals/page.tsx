import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { bedBath, date, money } from "@/lib/format";
import { photoUrls, unitName } from "@/lib/leasing";
import { publicCompany, publishedListings } from "@/lib/public-leasing";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Homes for rent" };

export default async function RentalsPage() {
  const company = await publicCompany();
  if (!company) notFound();
  const listings = await publishedListings(company.id);
  const covers = await photoUrls(createAdminClient(), listings.map((l) => l.photos[0]).filter(Boolean));
  let c = 0;
  return (
    <main className="mx-auto max-w-[1040px] px-4 py-8 sm:py-12">
      <div className="mb-8">
        <Logo companyName={company.name} />
      </div>
      <h1 className="text-[34px] font-extrabold leading-tight tracking-[-0.015em]">Available rentals</h1>
      <p className="mt-2 text-[17px] text-muted">{company.name}{company.office_phone ? ` · ${company.office_phone}` : ""}</p>
      {listings.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const cover = l.photos[0] ? covers[c++] : null;
            return (
              <li key={l.id}>
                <Link href={`/rentals/${l.id}`} className="block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface hover:shadow-md">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed links
                    <img src={cover} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="aspect-[4/3] w-full bg-surface-sunk" />
                  )}
                  <div className="space-y-1 p-4">
                    <p className="text-[20px] font-extrabold">{money(l.rent_cents)}<span className="text-[14px] font-semibold text-muted">/month</span></p>
                    <p className="font-semibold">{l.headline}</p>
                    <p className="text-[14px] text-muted">
                      {l.unit.kind === "commercial" ? "Commercial · " : l.unit.beds ? `${bedBath(l.unit.beds, l.unit.baths)} · ` : ""}{unitName(l.unit)}
                      {l.unit.property.city ? `, ${l.unit.property.city}` : ""}
                    </p>
                    <p className="text-[13px] text-subtle">Available {date(l.available_on, { blank: "now" })}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 text-[17px]">Nothing is available right now. Please check back soon{company.office_phone ? ` or call ${company.office_phone}` : ""}.</p>
      )}
      <p className="mt-12 text-[13px] text-subtle">We follow the Fair Housing Act and apply the same rental criteria to every applicant. Equal housing opportunity.</p>
    </main>
  );
}
