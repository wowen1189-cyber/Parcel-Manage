import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { FEE_BILL_STATUS as STATUS, FEE_KIND_LABEL, type FeeLine } from "@/lib/fee-billing";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { BillActions } from "../forms";

export const metadata = { title: "Fee bill" };

export default async function FeeBillPage({ params }: PageProps<"/fee-billing/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: bill } = await supabase
    .from("fee_invoice")
    .select("*, owner:entity!fee_invoice_owner_entity_id_fkey(id, name), manager:entity!fee_invoice_manager_entity_id_fkey(name)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!bill) notFound();
  const lines = bill.lines as FeeLine[];
  const monthName = new Date(`${bill.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const canAct = ["admin", "accountant"].includes(membership.role);

  return (
    <>
      <div className="print:hidden">
        <p className="mb-2 text-[13px]">
          <Link href={`/fee-billing?month=${bill.period_start.slice(0, 7)}`} className="font-semibold text-accent hover:underline">
            ← Fee billing
          </Link>
        </p>
      </div>
      <PageHeader
        title={`Fee bill #${bill.number}: ${bill.owner.name}`}
        subtitle={`${monthName} · from ${bill.manager.name}${bill.sent_at ? ` · e-mailed ${date(bill.sent_at.slice(0, 10))}` : ""}`}
        action={
          <span className="flex items-center gap-2">
            <Pill tone={STATUS[bill.status].tone}>{bill.status === "paid" && bill.paid_on ? `Paid ${date(bill.paid_on)}` : STATUS[bill.status].label}</Pill>
            <PrintButton />
          </span>
        }
      />
      <Card className="overflow-hidden">
        <CardHeader title="Fees" description={`${date(bill.period_start)} to ${date(bill.period_end)}`} />
        <Table minWidth={620}>
          <Thead>
            <Th>Property</Th>
            <Th>Fee</Th>
            <Th>How it&apos;s figured</Th>
            <Th right>Amount</Th>
          </Thead>
          <Tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <Td>{l.property}</Td>
                <Td>{FEE_KIND_LABEL[l.kind]}</Td>
                <Td className="text-[13px] text-muted">{l.detail}</Td>
                <Td right>{money(l.amountCents)}</Td>
              </tr>
            ))}
            <tr className="bg-surface-muted font-semibold">
              <Td>Total</Td>
              <Td />
              <Td />
              <Td right>{money(bill.total_cents)}</Td>
            </tr>
          </Tbody>
        </Table>
      </Card>
      {bill.status === "paid" && (
        <p className="mt-4 text-[13px] text-muted">
          Paid {date(bill.paid_on)} by {bill.method}
          {bill.reference ? ` (${bill.reference})` : ""}: out of {bill.owner.name}&apos;s operating account, into {bill.manager.name}&apos;s.
        </p>
      )}
      {canAct && bill.status !== "void" && (
        <Card className="mt-6 p-5 print:hidden">
          <BillActions id={bill.id} status={bill.status} sent={Boolean(bill.sent_at)} today={todayIn(company.time_zone)} />
        </Card>
      )}
    </>
  );
}
