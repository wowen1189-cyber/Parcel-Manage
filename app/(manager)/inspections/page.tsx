import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { nextDepositStep } from "@/lib/deposits";
import { contactName, date, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Inspections & deposits" };

type People = { is_primary: boolean; role: string; contact: Parameters<typeof contactName>[0] }[];
const tenantName = (people: People) => contactName([...people].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact) || "Tenant";

// Every open move-out with its next Fla. Stat. 83.49(3) deadline, and current leases with no move-in
// inspection on file (the record a deposit claim leans on).
export default async function InspectionsPage() {
  const { supabase, company } = await requireCompany();
  const today = todayIn(company.time_zone);
  const [{ data: moveOuts }, { data: leases }, { data: inspections }] = await Promise.all([
    supabase
      .from("move_out")
      .select("id, lease_id, vacated_on, decision, claim_notice_sent_on, claim_notice_method, lease(unit(label, property(name)), lease_tenant(is_primary, role, contact(kind, first_name, last_name, business_name)))")
      .eq("company_id", company.id)
      .is("closed_at", null),
    supabase
      .from("lease")
      .select("id, start_date, status, unit(label, property(name)), lease_tenant(is_primary, role, contact(kind, first_name, last_name, business_name))")
      .eq("company_id", company.id)
      .in("status", ["active", "notice"])
      .order("start_date", { ascending: false }),
    supabase.from("inspection").select("lease_id, kind, inspected_on").eq("company_id", company.id),
  ]);
  const byLease = new Map<string, { move_in?: string; move_out?: string }>();
  for (const i of inspections ?? []) byLease.set(i.lease_id, { ...byLease.get(i.lease_id), [i.kind]: i.inspected_on });
  const open = (moveOuts ?? []).map((m) => ({ m, step: nextDepositStep(m, today) })).sort((a, b) => a.step.next.localeCompare(b.step.next));
  const missing = (leases ?? []).filter((l) => !byLease.get(l.id)?.move_in);
  const where = (u: { label: string; property: { name: string } }) => `${u.property.name}${u.label !== "Home" ? ` ${u.label}` : ""}`;

  return (
    <>
      <PageHeader title="Inspections & deposits" subtitle="Open move-outs with their Florida deposit deadlines, and current leases still missing a move-in inspection." />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Open move-outs" description="Return the deposit within 15 days, or send the claim notice by certified mail within 30 (Fla. Stat. 83.49(3))." />
          {open.length ? (
            <Table minWidth={760}>
              <Thead>
                <Th>Tenant</Th>
                <Th>Moved out</Th>
                <Th>Inspection</Th>
                <Th>Next step</Th>
                <Th>Due</Th>
              </Thead>
              <Tbody>
                {open.map(({ m, step }) => (
                  <tr key={m.id}>
                    <Td>
                      <Link href={`/tenants/${m.lease_id}/move-out`} className="font-semibold text-accent hover:underline">
                        {tenantName(m.lease.lease_tenant)}
                      </Link>
                      <p className="text-[13px] text-subtle">{where(m.lease.unit)}</p>
                    </Td>
                    <Td className="text-[13px]">{date(m.vacated_on)}</Td>
                    <Td className="text-[13px]">{byLease.get(m.lease_id)?.move_out ? <Pill tone="success">Done</Pill> : <Pill tone="warn">Not done</Pill>}</Td>
                    <Td className="text-[13px]">{step.label}</Td>
                    <Td className="whitespace-nowrap text-[13px]">
                      {date(step.next)} {step.left < 0 ? <Pill tone="danger">{-step.left} days late</Pill> : <Pill tone={step.left <= 5 ? "warn" : "neutral"}>{step.left} days</Pill>}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No open move-outs">Record a move-out from the tenant&apos;s page when they hand back the keys.</EmptyState>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="No move-in inspection on file" description={`${missing.length} of ${leases?.length ?? 0} current leases. A dated move-in record with photos is what tells damage from normal wear at move-out.`} />
          {missing.length ? (
            <Table minWidth={620}>
              <Thead>
                <Th>Tenant</Th>
                <Th>Lease started</Th>
                <Th />
              </Thead>
              <Tbody>
                {missing.slice(0, 100).map((l) => (
                  <tr key={l.id}>
                    <Td>
                      <Link href={`/tenants/${l.id}`} className="font-semibold text-accent hover:underline">
                        {tenantName(l.lease_tenant)}
                      </Link>
                      <p className="text-[13px] text-subtle">{where(l.unit)}</p>
                    </Td>
                    <Td className="text-[13px]">{date(l.start_date)}</Td>
                    <Td right>
                      <Link href={`/tenants/${l.id}/inspection/move_in`} className="text-[13px] font-semibold text-accent hover:underline">
                        Start move-in inspection
                      </Link>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="Every current lease has a move-in inspection" />
          )}
        </Card>
      </div>
    </>
  );
}
