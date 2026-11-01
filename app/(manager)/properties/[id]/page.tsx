import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader, Pill, StatTile } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { bedBath, contactName, date, money, oneLineAddress, PROPERTY_TYPE_LABEL, UNIT_STATUS } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { PropertyForm } from "../forms";

export async function generateMetadata({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("property").select("name").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: data?.name ?? "Property" };
}

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const [{ data: p }, { data: entities }] = await Promise.all([
    supabase
      .from("property")
      .select(
        "*, entity(id, name), property_owner(ownership_pct, contact(first_name, last_name, business_name)), unit(id, label, kind, beds, baths, sqft, market_rent_cents, status, amenities, lease(id, status, rent_cents, end_date, opening_balance_cents, lease_tenant(is_primary, contact(first_name, last_name, business_name))))",
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
        <StatTile label="Owning LLC" value={<span className="text-lg">{p.entity?.name}</span>} note={p.property_owner.map((o) => `${contactName(o.contact)} ${Number(o.ownership_pct)}%`).join(" · ") || "Ownership split not set"} />
      </div>

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
                    <p className="text-[13px] text-subtle">{u.kind === "commercial" ? "Commercial" : "Residential"}</p>
                  </Td>
                  <Td>
                    <p>{u.kind === "commercial" ? "—" : bedBath(u.beds, u.baths)}</p>
                    {u.sqft && <p className="text-[13px] text-subtle">{u.sqft.toLocaleString()} sq ft</p>}
                  </Td>
                  <Td>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </Td>
                  <Td>
                    {lease ? (
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
