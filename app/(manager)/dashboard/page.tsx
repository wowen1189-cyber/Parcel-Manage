import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead, RowLink } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listTenants } from "@/lib/tenants";
import { listVendors } from "@/lib/vendor-list";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, company } = await requireCompany();
  const today = todayIn(company.time_zone);
  const [{ count: propertyCount }, { data: units }, leases, blockedVendors] = await Promise.all([
    supabase.from("property").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("unit").select("status, market_rent_cents").eq("company_id", company.id),
    listTenants(supabase, company.id, { q: "", property: "", show: "" }, today),
    listVendors(supabase, company.id, { q: "", trade: "", paperwork: "blocked" }, today),
  ]);
  const total = units?.length ?? 0;
  const occupied = units?.filter((u) => u.status === "occupied" || u.status === "notice").length ?? 0;
  const vacant = total - occupied;
  const rent = leases.reduce((s, l) => s + l.rentCents, 0);
  const owing = leases.filter((l) => (l.balanceCents ?? 0) > 0).sort((a, b) => (b.balanceCents ?? 0) - (a.balanceCents ?? 0));
  const owed = owing.reduce((s, l) => s + (l.balanceCents ?? 0), 0);
  const ending = leases.filter((l) => l.timing.daysLeft != null && l.timing.daysLeft <= 90).sort((a, b) => (a.timing.daysLeft ?? 0) - (b.timing.daysLeft ?? 0));

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Good to see you. Here's ${company.name} today.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Occupancy" value={total ? `${Math.round((occupied / total) * 100)}%` : "—"} note={`${occupied} of ${total} units · ${propertyCount ?? 0} properties`} />
        <StatTile label="Monthly rent" value={money(rent)} note={`${leases.length} leases`} />
        <StatTile label="Owed by tenants" value={money(owed)} note={`${owing.length} tenants · from AppFolio Nov 1`} />
        <StatTile label="Vacant" value={vacant} note={vacant === 1 ? "unit" : "units"} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Who owes the most" action={<Link href="/tenants?show=owes" className="text-[13px] font-semibold text-accent hover:underline">All {owing.length}</Link>} />
          {owing.length ? (
            <Table minWidth={420}>
              <Thead>
                <Th>Tenant</Th>
                <Th right>Owes</Th>
              </Thead>
              <Tbody>
                {owing.slice(0, 6).map((l) => (
                  <tr key={l.leaseId}>
                    <Td>
                      <RowLink href={`/tenants/${l.leaseId}`} sub={`${l.propertyName} · ${l.unitLabel}`}>
                        {l.name}
                      </RowLink>
                    </Td>
                    <Td right className="font-semibold text-danger">{money(l.balanceCents)}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="Nobody owes anything" />
          )}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Leases ending in 90 days" action={<Link href="/tenants?show=ending" className="text-[13px] font-semibold text-accent hover:underline">All {ending.length}</Link>} />
          {ending.length ? (
            <Table minWidth={420}>
              <Thead>
                <Th>Tenant</Th>
                <Th>Ends</Th>
              </Thead>
              <Tbody>
                {ending.slice(0, 6).map((l) => (
                  <tr key={l.leaseId}>
                    <Td>
                      <RowLink href={`/tenants/${l.leaseId}`} sub={`${l.propertyName} · ${l.unitLabel}`}>
                        {l.name}
                      </RowLink>
                    </Td>
                    <Td>
                      <Pill tone={l.timing.tone}>{l.timing.label}</Pill>
                      <p className="mt-1 text-[13px] text-subtle">{date(l.status === "notice" ? l.moveOutOn : l.endDate)}</p>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No leases end in the next 90 days" />
          )}
        </Card>
        <Card>
          <CardHeader title="Vendors missing paperwork" action={<Link href="/vendors?paperwork=blocked" className="text-[13px] font-semibold text-accent hover:underline">Fix</Link>} />
          <div className="px-5 py-4 text-sm">
            {blockedVendors.length ? (
              <p>
                <span className="font-semibold">{blockedVendors.length} on-site vendors</span> can&apos;t be sent work orders until their W-9 and insurance are on file.
              </p>
            ) : (
              <p>All on-site vendors have their W-9 and insurance on file.</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Open work orders" description="When each is scheduled and who it's assigned to." />
          <EmptyState title="Coming next">Maintenance requests and work orders are the next part of Phase 1.</EmptyState>
        </Card>
      </div>
    </>
  );
}
