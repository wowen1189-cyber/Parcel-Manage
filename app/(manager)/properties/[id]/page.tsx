import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { bedBath, contactName, date, money, oneLineAddress, PROPERTY_TYPE_LABEL, UNIT_STATUS } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { LeaseSettingsForm, PropertyForm, UnitForm } from "../forms";
import { allowsRepairDeductible, missingLeaseSettings, readLeaseSettings } from "@/lib/property-lease-settings";
import { describeFee, effectiveFee, monthlyFee, readCompanyFee } from "@/lib/management-fees";
import { UNASSIGNED_OWNER } from "@/lib/owners";
import { FeeForm } from "../../owners/forms";

export async function generateMetadata({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("property").select("name").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: data?.name ?? "Property" };
}

export default async function PropertyPage({ params, searchParams }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const [{ data: p }, { data: entities }] = await Promise.all([
    supabase
      .from("property")
      .select(
        "*, entity(id, name, management_fee), property_owner(ownership_pct, contact(first_name, last_name, business_name)), unit(id, label, kind, beds, baths, sqft, market_rent_cents, status, amenities, notes, lease(id, status, rent_cents, end_date, opening_balance_cents, lease_tenant(is_primary, contact(first_name, last_name, business_name))))",
      )
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase.from("entity").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  if (!p) notFound();

  const units = [...(p.unit ?? [])].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const current = (u: (typeof units)[number]) => (u.lease ?? []).find((l) => l.status === "active" || l.status === "notice");
  const occupied = units.filter((u) => u.status === "occupied" || u.status === "notice").length;
  const rent = units.reduce((s, u) => s + (current(u)?.rent_cents ?? 0), 0);
  const market = units.reduce((s, u) => s + (u.market_rent_cents ?? 0), 0);
  const owed = units.reduce((s, u) => s + Math.max(0, current(u)?.opening_balance_cents ?? 0), 0);
  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const leaseSettings = readLeaseSettings(p.lease_settings, p.property_type, units.length);
  const leaseMissing = missingLeaseSettings(leaseSettings, p.year_built != null && p.year_built < 1978);
  const companyFee = readCompanyFee(company.settings);
  const ownerFee = effectiveFee(null, p.entity?.management_fee, companyFee);
  const fee = effectiveFee(p.management_fee, p.entity?.management_fee, companyFee);
  const estFee = monthlyFee(fee.fee, rent, occupied);
  const editing = typeof sp.edit === "string" ? units.find((u) => u.id === sp.edit) : undefined;
  const defaultKind = p.kind === "commercial" ? "commercial" : "residential";

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/properties" className="font-semibold text-accent hover:underline">
          ← Properties
        </Link>
      </p>
      <PageHeader title={p.name} subtitle={oneLineAddress(p)} action={<Pill tone={p.kind === "commercial" ? "info" : "neutral"}>{PROPERTY_TYPE_LABEL[p.property_type ?? ""] ?? p.kind}</Pill>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Occupancy" value={units.length ? `${Math.round((occupied / units.length) * 100)}%` : "—"} note={`${occupied} of ${units.length} units`} />
        <StatTile label="Monthly rent" value={money(rent)} note={`Market ${money(market)}`} />
        <StatTile label="Owed (from AppFolio)" value={money(owed)} note="As of Nov 1, 2026" />
        <StatTile label="Owner" value={p.entity ? <Link href={`/owners/${p.entity.id}`} className="text-lg hover:underline">{p.entity.name === UNASSIGNED_OWNER ? "Not set yet" : p.entity.name}</Link> : "—"} note={p.property_owner.map((o) => `${contactName(o.contact)} ${Number(o.ownership_pct)}%`).join(" · ") || "Ownership split not set"} />
      </div>

      {sp.added && (
        <div className="mt-6">
          <Notice tone="success">Property added. {units.length ? "" : "Now add its units below."}</Notice>
        </div>
      )}
      {editing && canEdit && (
        <Card className="mt-6">
          <CardHeader title={`Edit unit ${editing.label}`} action={<Link href={`/properties/${p.id}`} className="text-[13px] font-semibold text-accent hover:underline">Done</Link>} />
          <div className="p-5">
            <UnitForm key={editing.id} propertyId={p.id} defaultKind={defaultKind} canEdit={canEdit} unit={{ id: editing.id, label: editing.label, kind: editing.kind, beds: editing.beds, baths: editing.baths, sqft: editing.sqft, market_rent_cents: editing.market_rent_cents, status: editing.status, amenities: editing.amenities, notes: editing.notes }} />
          </div>
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Units" description="Each unit, who lives or works there, and their lease." />
        <Table minWidth={900}>
          <Thead>
            <Th>Unit</Th>
            <Th>Size</Th>
            <Th>Status</Th>
            <Th>Tenant</Th>
            <Th right>Market rent</Th>
            <Th right>Rent</Th>
            <Th>Lease ends</Th>
          </Thead>
          <Tbody>
            {units.map((u) => {
              const lease = current(u);
              const tenants = (lease?.lease_tenant ?? []).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
              const status = UNIT_STATUS[u.status] ?? { label: u.status, tone: "neutral" as const };
              return (
                <tr key={u.id}>
                  <Td>
                    <p className="font-semibold">{u.label}</p>
                    <p className="text-[13px] text-subtle">
                      {u.kind === "commercial" ? "Commercial" : "Residential"}
                      {canEdit && (
                        <>
                          {" · "}
                          <Link href={`/properties/${p.id}?edit=${u.id}`} className="font-semibold text-accent hover:underline">
                            Edit
                          </Link>
                        </>
                      )}
                    </p>
                  </Td>
                  <Td>
                    <p>{u.kind === "commercial" ? "—" : bedBath(u.beds, u.baths)}</p>
                    {u.sqft && <p className="text-[13px] text-subtle">{u.sqft.toLocaleString()} sq ft</p>}
                  </Td>
                  <Td>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Td>
                  <Td>
                    {!lease && canEdit ? (
                      <Link href={`/tenants/new?unit=${u.id}`} className="text-[13px] font-semibold text-accent hover:underline">
                        Start a lease
                      </Link>
                    ) : lease ? (
                      <RowLink href={`/tenants/${lease.id}`} sub={tenants.length > 1 ? `+ ${tenants.slice(1).map((t) => contactName(t.contact)).join(", ")}` : undefined}>
                        {contactName(tenants[0]?.contact) || "Tenant"}
                      </RowLink>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </Td>
                  <Td right>{money(u.market_rent_cents)}</Td>
                  <Td right>{lease ? money(lease.rent_cents) : "—"}</Td>
                  <Td>{lease ? (lease.end_date ? date(lease.end_date) : "Month-to-month") : "—"}</Td>
                </tr>
              );
            })}
          </Tbody>
        </Table>
        {canEdit && (
          <details className="border-t border-line px-5 py-4" open={!units.length}>
            <summary className="cursor-pointer text-[13px] font-semibold text-accent">+ Add a unit</summary>
            <div className="mt-3">
              <UnitForm propertyId={p.id} defaultKind={defaultKind} canEdit={canEdit} />
            </div>
          </details>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Management fee"
          description={`What you charge to manage this property. Est. ${money(estFee)} this month if every tenant pays in full.`}
          action={<Pill tone={fee.source === "property" ? "info" : "neutral"}>{fee.source === "property" ? "Own fee" : fee.source === "owner" ? "Owner's agreement" : "Company default"}</Pill>}
        />
        <FeeForm
          key={fee.source}
          scope="property"
          targetId={p.id}
          fee={fee.fee}
          custom={fee.source === "property"}
          inheritLabel={`Use the owner's ${ownerFee.source === "owner" ? "agreement" : "fee (company default)"}: ${describeFee(ownerFee.fee)}`}
          canEdit={canEdit}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Lease settings"
          description="The checkboxes from your lease, set once for this property. Every lease here fills in from them."
          action={leaseMissing.length ? <Pill tone="warn">Missing: {leaseMissing.join(", ")}</Pill> : <Pill tone="success">Complete</Pill>}
        />
        <LeaseSettingsForm
          propertyId={p.id}
          settings={leaseSettings}
          single={p.property_type === "single_family"}
          deductibleAllowed={allowsRepairDeductible(p.property_type, units.length)}
          pre1978={p.year_built != null && p.year_built < 1978}
          canEdit={canEdit}
        />
      </Card>

      <div className="mt-6">
        <PropertyForm
          canEdit={canEdit}
          entities={entities ?? []}
          property={{
            id: p.id,
            name: p.name,
            property_type: p.property_type ?? (p.kind === "commercial" ? "commercial" : "multi_family"),
            address_line1: p.address_line1,
            address_line2: p.address_line2,
            city: p.city,
            state: p.state,
            postal_code: p.postal_code,
            county: p.county,
            year_built: p.year_built,
            entity_id: p.entity_id,
            notes: p.notes,
          }}
          owners={p.property_owner.map((o) => ({ name: contactName(o.contact), pct: Number(o.ownership_pct) }))}
        />
      </div>
    </>
  );
}
