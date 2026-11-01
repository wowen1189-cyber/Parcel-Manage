import Link from "next/link";
import { buttonClass, Card, CardHeader, EmptyState, Notice, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { money } from "@/lib/format";
import { describeFee, readCompanyFee } from "@/lib/management-fees";
import { listOwners } from "@/lib/owners";
import { requireCompany } from "@/lib/session";
import { FeeForm } from "./forms";

export const metadata = { title: "Owners" };

export default async function OwnersPage({ searchParams }: PageProps<"/owners">) {
  const { supabase, company, membership } = await requireCompany();
  const params = await searchParams;
  const q = param(params, "q");
  const companyFee = readCompanyFee(company.settings);
  const owners = await listOwners(supabase, company.id, companyFee, q);
  const shown = owners.filter((o) => o.properties.length || !o.unassigned);
  const unassigned = owners.find((o) => o.unassigned && o.properties.length);
  const totals = shown.reduce((t, o) => ({ properties: t.properties + o.properties.length, units: t.units + o.units, rent: t.rent + o.rentCents, fee: t.fee + o.estFeeCents }), { properties: 0, units: 0, rent: 0, fee: 0 });
  const canEdit = ["admin", "property_manager"].includes(membership.role);

  return (
    <>
      <PageHeader
        title="Owners"
        subtitle="Who owns each property, their management agreement and what you earn managing it."
        action={
          canEdit && (
            <Link href="/owners/new" className={buttonClass("primary", true)}>
              + New owner
            </Link>
          )
        }
      />
      {params.deleted && (
        <div className="mb-4">
          <Notice tone="success">Owner deleted.</Notice>
        </div>
      )}
      {unassigned && (
        <div className="mb-4">
          <Notice tone="warn">
            {unassigned.properties.length} properties don&apos;t have their real owner yet.{" "}
            <Link href={`/owners/${unassigned.id}`} className="font-semibold underline">
              See which ones
            </Link>
            , then open the right owner (or add one) and put them under it.
          </Notice>
        </div>
      )}
      <Card className="overflow-hidden">
        <ListFilters action="/owners" search={q} searchPlaceholder="Search by owner, property or partner" exportHref={exportLink("/owners/export", { q })} count={shown.length} noun={["owner", "owners"]} />
        {!shown.length ? (
          <EmptyState title="No owners match">Try a different search.</EmptyState>
        ) : (
          <Table minWidth={860}>
            <Thead>
              <Th>Owner</Th>
              <Th>Properties</Th>
              <Th>Fees</Th>
              <Th right>Units</Th>
              <Th right>Monthly rent</Th>
              <Th right>Est. monthly fee</Th>
            </Thead>
            <Tbody>
              {shown.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <RowLink href={`/owners/${o.id}`} sub={[o.type, o.email].filter(Boolean).join(" · ") || undefined}>
                      {o.name}
                    </RowLink>
                    {o.unassigned && (
                      <p className="mt-1">
                        <Pill tone="warn">Needs sorting</Pill>
                      </p>
                    )}
                  </Td>
                  <Td className="text-[13px]">{o.properties.length ? o.properties.map((p) => p.name).join(", ") : <span className="text-subtle">None yet</span>}</Td>
                  <Td className="text-[13px]">
                    {o.unassigned ? <span className="text-subtle">—</span> : o.hasOwnFee ? describeFee(o.fee) : <span className="text-subtle">Company default</span>}
                  </Td>
                  <Td right>{o.units}</Td>
                  <Td right>{money(o.rentCents)}</Td>
                  <Td right className="font-semibold">
                    {money(o.estFeeCents)}
                  </Td>
                </tr>
              ))}
              <tr className="bg-surface-muted font-semibold">
                <Td>Total</Td>
                <Td>{totals.properties} properties</Td>
                <Td />
                <Td right>{totals.units}</Td>
                <Td right>{money(totals.rent)}</Td>
                <Td right>{money(totals.fee)}</Td>
              </tr>
            </Tbody>
          </Table>
        )}
        <p className="border-t border-line px-5 py-3 text-[13px] text-subtle">
          Est. monthly fee assumes every current tenant pays this month&apos;s rent in full. Actual fees post from rent collected once payments move into Parcel Manage.
        </p>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Company default fees" description={`Owners without their own agreement use these. Now: ${describeFee(companyFee)}.`} />
        <FeeForm scope="company" fee={companyFee} custom canEdit={membership.role === "admin"} />
      </Card>
    </>
  );
}

