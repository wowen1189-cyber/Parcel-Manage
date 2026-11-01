import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardHeader, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { bedBath, contactName, date, money, todayIn } from "@/lib/format";
import { lateFeeText, leaseTiming } from "@/lib/leases";
import { requireCompany } from "@/lib/session";
import { LeaseNotesForm, TenantContactForm } from "../forms";

export async function generateMetadata({ params }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase
    .from("lease_tenant")
    .select("contact(first_name, last_name, business_name)")
    .eq("lease_id", id)
    .eq("company_id", company.id)
    .eq("is_primary", true)
    .maybeSingle();
  return { title: contactName(data?.contact) || "Lease" };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2">
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function LeasePage({ params }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select(
      "*, unit(id, label, kind, beds, baths, sqft, amenities, access_notes, property(id, name)), lease_tenant(is_primary, role, contact(id, kind, first_name, last_name, business_name, email, mobile, phone, preferred_contact, tags, emergency_contact(id, name, relationship, phone), vehicle(id, make_model, color, tag_number, tag_state, parking_permit_number))), recurring_charge(id, description, amount_cents)",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();

  const today = todayIn(company.time_zone);
  const rules = readBusinessRules(company.settings);
  const people = [...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const primary = people[0]?.contact;
  const timing = leaseTiming(l, today);
  const lateFee = lateFeeText(l, rules);
  const recurring = l.recurring_charge ?? [];
  const monthly = l.rent_cents + recurring.reduce((s, c) => s + c.amount_cents, 0);
  const canEdit = ["admin", "property_manager", "leasing_agent"].includes(membership.role);
  const commercial = l.unit.kind === "commercial";

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader
        title={contactName(primary) || "Lease"}
        subtitle={`${l.unit.property.name} · ${l.unit.label}${people.length > 1 ? ` · with ${people.slice(1).map((p) => contactName(p.contact)).join(", ")}` : ""}`}
        action={<Pill tone={timing.tone}>{timing.label}</Pill>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Owes" value={<span className={(l.opening_balance_cents ?? 0) > 0 ? "text-danger" : undefined}>{money(l.opening_balance_cents, { blank: "$0.00" })}</span>} note={l.opening_balance_as_of ? `From AppFolio, ${date(l.opening_balance_as_of)}` : undefined} />
        <StatTile label="Monthly total" value={money(monthly)} note={`Rent ${money(l.rent_cents)}${recurring.length ? ` + ${money(monthly - l.rent_cents)} other` : ""}`} />
        <StatTile label="Deposit held" value={money(l.deposit_cents)} note={l.deposit_pending_cents ? `${money(l.deposit_pending_cents)} pending` : commercial ? "Commercial lease" : "Fla. Stat. 83.49 applies"} />
        <StatTile label={l.status === "notice" ? "Moving out" : "Lease ends"} value={<span className="text-xl">{l.status === "notice" ? date(l.move_out_on) : l.end_date ? date(l.end_date) : "Month-to-month"}</span>} note={`Started ${date(l.start_date)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Lease terms" description={commercial ? "Commercial lease (Fla. Stat. ch. 83, Part I)." : "Residential lease (Fla. Stat. ch. 83, Part II)."} />
            <dl className="divide-y divide-line px-5 py-2 text-sm">
              <Row label="Unit">
                <Link href={`/properties/${l.unit.property.id}`} className="font-semibold text-accent hover:underline">
                  {l.unit.property.name}
                </Link>{" "}
                · {l.unit.label}
                {!commercial && <span className="text-subtle"> · {bedBath(l.unit.beds, l.unit.baths)}</span>}
                {l.unit.sqft && <span className="text-subtle"> · {l.unit.sqft.toLocaleString()} sq ft</span>}
              </Row>
              <Row label="Term">
                {date(l.start_date)} to {l.end_date ? date(l.end_date) : "month-to-month"}
                {l.term_months && <span className="text-subtle"> ({l.term_months} months)</span>}
              </Row>
              {l.move_in_on && <Row label="Moved in">{date(l.move_in_on)}</Row>}
              <Row label="Rent">{money(l.rent_cents)} a month</Row>
              {recurring.map((c) => (
                <Row key={c.id} label="Also monthly">
                  {money(c.amount_cents)} <span className="text-subtle">{c.description}</span>
                </Row>
              ))}
              <Row label="Late fee">
                {lateFee.text}{" "}
                <span className="text-subtle">{lateFee.source === "lease" ? "(this lease)" : "(company default)"}</span>
              </Row>
              {l.next_rent_increase_on && (
                <Row label="Next increase">
                  {l.next_rent_cents ? `${money(l.next_rent_cents)} from ` : "Due "}
                  {date(l.next_rent_increase_on)}
                </Row>
              )}
              <Row label="Deposit">
                {money(l.deposit_cents)} held
                {l.deposit_pending_cents > 0 && `, ${money(l.deposit_pending_cents)} pending`}
              </Row>
              {l.unit.amenities.length > 0 && <Row label="Amenities">{l.unit.amenities.join(", ")}</Row>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="People on this lease" description="Contact details for everyone on the lease." />
            <div className="divide-y divide-line">
              {people.map(({ contact: c, is_primary }) => (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{contactName(c)}</p>
                    {is_primary && <Pill tone="info">Primary</Pill>}
                    {c.kind === "business" && <Pill>Business</Pill>}
                    {c.tags.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {[c.mobile && `Mobile ${c.mobile}`, c.phone && `Phone ${c.phone}`, c.email].filter(Boolean).join(" · ") || (
                      <span className="font-semibold text-warn">No phone or email on file</span>
                    )}
                  </p>
                  {(c.emergency_contact.length > 0 || c.vehicle.length > 0) && (
                    <p className="mt-1 text-[13px] text-subtle">
                      {c.emergency_contact.map((e) => `Emergency: ${e.name}${e.relationship ? ` (${e.relationship})` : ""} ${e.phone}`).join(" · ")}
                      {c.vehicle.map((v) => ` · ${v.make_model}${v.tag_number ? `, tag ${v.tag_number}` : ""}${v.parking_permit_number ? `, permit ${v.parking_permit_number}` : ""}`).join("")}
                    </p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] font-semibold text-accent">Edit contact details</summary>
                    <div className="mt-3">
                      <TenantContactForm
                        leaseId={l.id}
                        canEdit={canEdit}
                        contact={{ id: c.id, kind: c.kind, first_name: c.first_name, last_name: c.last_name, business_name: c.business_name, email: c.email, mobile: c.mobile, phone: c.phone, preferred_contact: c.preferred_contact }}
                      />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Ledger" />
            <EmptyState title={`Balance ${money(l.opening_balance_cents, { blank: "$0.00" })}`}>
              Brought over from AppFolio on {date(l.opening_balance_as_of)}. Rent charges, payments and late fees will list here once
              accounting is switched on.
            </EmptyState>
          </Card>
          <Card>
            <CardHeader title="Notes and access" />
            <LeaseNotesForm leaseId={l.id} unitId={l.unit.id} notes={l.notes} accessNotes={l.unit.access_notes} canEdit={canEdit} />
          </Card>
          <Card>
            <CardHeader title="Documents" />
            <EmptyState title="No documents yet">Upload the signed lease and addenda here once document storage is on.</EmptyState>
          </Card>
        </div>
      </div>
    </>
  );
}
