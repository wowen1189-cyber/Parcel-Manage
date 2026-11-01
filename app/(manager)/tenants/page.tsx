import { Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listTenants, TENANT_SHOW_OPTIONS } from "@/lib/tenants";

export const metadata = { title: "Tenants & leases" };

export default async function TenantsPage({ searchParams }: PageProps<"/tenants">) {
  const { supabase, company } = await requireCompany();
  const params = await searchParams;
  const filters = { q: param(params, "q"), property: param(params, "property"), show: param(params, "show") };
  const today = todayIn(company.time_zone);
  const [rows, { data: properties }] = await Promise.all([
    listTenants(supabase, company.id, filters, today),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const owed = rows.reduce((s, r) => s + Math.max(0, r.balanceCents ?? 0), 0);

  return (
    <>
      <PageHeader title="Tenants & leases" subtitle="Everyone renting from you, their lease and what they owe." />
      <Card className="overflow-hidden">
        <ListFilters
          action="/tenants"
          search={filters.q}
          searchPlaceholder="Search by name, unit, phone or email"
          selects={[
            { name: "property", label: "Property", value: filters.property, options: (properties ?? []).map((p) => [p.id, p.name]) },
            { name: "show", label: "Show", value: filters.show, options: TENANT_SHOW_OPTIONS },
          ]}
          exportHref={exportLink("/tenants/export", filters)}
          count={rows.length}
          noun={["lease", "leases"]}
        />
        {!rows.length ? (
          <EmptyState title="No leases match">Try a different search or clear the filters.</EmptyState>
        ) : (
          <Table minWidth={980}>
            <Thead>
              <Th>Tenant</Th>
              <Th>Property · unit</Th>
              <Th>Contact</Th>
              <Th right>Rent</Th>
              <Th right>Deposit</Th>
              <Th>Lease</Th>
              <Th right>Owes</Th>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <tr key={r.leaseId}>
                  <Td>
                    <RowLink href={`/tenants/${r.leaseId}`} sub={r.others.length ? `+ ${r.others.join(", ")}` : undefined}>
                      {r.name || "Unnamed tenant"}
                    </RowLink>
                  </Td>
                  <Td>
                    <p>{r.propertyName}</p>
                    <p className="text-[13px] text-subtle">
                      {r.unitLabel}
                      {r.unitKind === "commercial" && " · Commercial"}
                    </p>
                  </Td>
                  <Td className="text-[13px]">
                    {r.phone || r.email ? (
                      <>
                        {r.phone && <p>{r.phone}</p>}
                        {r.email && <p className="text-subtle">{r.email}</p>}
                      </>
                    ) : (
                      <Pill tone="warn">Missing</Pill>
                    )}
                  </Td>
                  <Td right>{money(r.rentCents)}</Td>
                  <Td right>
                    {money(r.depositCents)}
                    {r.depositPendingCents > 0 && <p className="text-[13px] text-subtle">+ {money(r.depositPendingCents)} pending</p>}
                  </Td>
                  <Td>
                    <Pill tone={r.timing.tone}>{r.timing.label}</Pill>
                    <p className="mt-1 text-[13px] text-subtle">{r.status === "notice" && r.moveOutOn ? `Moving out ${date(r.moveOutOn)}` : r.endDate ? `Ends ${date(r.endDate)}` : `Since ${date(r.startDate)}`}</p>
                  </Td>
                  <Td right className={(r.balanceCents ?? 0) > 0 ? "font-semibold text-danger" : undefined}>
                    {money(r.balanceCents, { blank: "$0.00" })}
                  </Td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-semibold">
                <Td>Total</Td>
                <Td />
                <Td />
                <Td right>{money(rows.reduce((s, r) => s + r.rentCents, 0))}</Td>
                <Td right>{money(rows.reduce((s, r) => s + r.depositCents, 0))}</Td>
                <Td />
                <Td right>{money(owed)}</Td>
              </tr>
            </Tbody>
          </Table>
        )}
        <p className="border-t border-line px-5 py-3 text-[13px] text-subtle">
          &ldquo;Owes&rdquo; is each tenant&apos;s balance brought over from AppFolio on Nov 1, 2026. It becomes a live ledger once charges and payments are recorded here.
        </p>
      </Card>
    </>
  );
}
