import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui";
import { ROOT_DOMAIN } from "@/lib/env";
import { bedBath } from "@/lib/format";
import { photoUrls, unitName } from "@/lib/leasing";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";
import { removeListingPhoto } from "../../actions";
import { ListingForm, ListingPhotos, SendLinkForm } from "../../forms";

export const metadata = { title: "Listing" };

export default async function UnitListingPage({ params }: PageProps<"/leasing/units/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data: u } = await supabase
    .from("unit")
    .select("id, label, beds, baths, sqft, kind, market_rent_cents, status, property(name, city), listing(id, headline, description, rent_cents, deposit_cents, available_on, pets_allowed, amenities, photos, status)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!u) notFound();
  const l = u.listing;
  const photos = l ? await photoUrls(createAdminClient(), l.photos) : [];
  const name = unitName(u);
  const publicUrl = l?.status === "published" && company.subdomain ? companyUrl(company.subdomain, ROOT_DOMAIN, `/rentals/${l.id}`) : null;
  return (
    <>
      <PageHeader
        title={name}
        subtitle={`${u.kind === "commercial" ? "Commercial" : u.beds ? bedBath(u.beds, u.baths) : "Residential"}${u.sqft ? ` · ${u.sqft} sq ft` : ""}`}
        action={
          <Link href="/leasing" className="text-[14px] font-semibold text-accent">
            ← Leasing
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Listing"
              description={publicUrl ? "Live on your rentals page." : "Not on your rentals page yet."}
              action={l ? <Pill tone={l.status === "published" ? "success" : "neutral"}>{l.status === "published" ? "Published" : l.status === "closed" ? "Closed" : "Draft"}</Pill> : undefined}
            />
            <div className="px-5 py-4">
              {publicUrl && (
                <p className="mb-4 text-[14px]">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">
                    {publicUrl}
                  </a>
                </p>
              )}
              <ListingForm
                unitId={u.id}
                listing={l}
                defaults={{ headline: u.kind === "commercial" ? `Commercial space at ${u.property.name}` : `${u.beds ? bedBath(u.beds, u.baths) : "Home"} at ${u.property.name}${u.property.city ? `, ${u.property.city}` : ""}`, rentCents: u.market_rent_cents }}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Photos" description="The first photo leads the listing." />
            <div className="space-y-4 px-5 py-4">
              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((src, i) => (
                    <figure key={l!.photos[i]} className="space-y-1">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links */}
                      <img src={src} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full rounded-[var(--radius-control)] object-cover" />
                      <form action={removeListingPhoto}>
                        <input type="hidden" name="unit_id" value={u.id} />
                        <input type="hidden" name="path" value={l!.photos[i]} />
                        <button className="text-[12px] font-semibold text-danger">Remove</button>
                      </form>
                    </figure>
                  ))}
                </div>
              )}
              {l ? <ListingPhotos unitId={u.id} /> : <p className="text-[14px] text-subtle">Save the listing first, then add photos.</p>}
            </div>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title="Send an application link" description="A personal link for this unit, with their name filled in." />
          <div className="px-5 py-4">
            <SendLinkForm unitId={u.id} />
          </div>
        </Card>
      </div>
    </>
  );
}
