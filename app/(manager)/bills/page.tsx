import Link from "next/link";
import { buttonClass, Card, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { BILL_STATUS, listBills } from "@/lib/bills";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Bills" };

export default async function BillsPage({ searchParams }: PageProps<"/bills">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const filters = { status: param(sp, "status") || "open", property: param(sp, "property"), q: param(sp, "q") };
  const [bills, { data: properties }, open] = await Promise.all([
    listBills(supabase, company.id, filters),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
    listBills(supabase, company.id, { status: "open", property: "", q: "" }),
  ]);
  const today = todayIn(company.time_zone);
  const needsApproval = open.filter((b) => b.status === "received");
  const unpaid = open.filter((b) => b.status !== "received");

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="Vendor invoices: approve to post the expense, then record payment."
        action={
          <Link href="/bills/new" className={buttonClass("primary", true)}>
            + New bill
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Needs approval" value={needsApproval.length} note={money(needsApproval.reduce((s, b) => s + b.amount_cents, 0))} />
        <StatTile label="Approved, unpaid" value={money(unpaid.reduce((s, b) => s + b.amount_cents, 0))} note={`${unpaid.length} bills`} />
        <StatTile label="Past due" value={open.filter((b) => b.due_date && b.due_date < today).length} note="Open bills past their due date" />
      </div>
      <Card className="overflow-hidden">
        <ListFilters
          action="/bills"
          search={filters.q}
          searchPlaceholder="Search vendor, invoice number or memo"
          selects={[
            { name: "status", label: "Status", value: filters.status, options: [["open", "Open"], ...Object.entries(BILL_STATUS).map(([k, v]) => [k, v.label] as [string, string])] },
            { name: "property", label: "Property", value: filters.property, options: (properties ?? []).map((p) => [p.id, p.name]) },
          ]}
          exportHref={exportLink("/bills/export", filters)}
          count={bills.length}
          noun={["bill", "bills"]}
        />
        {bills.length ? (
          <Table minWidth={820}>
            <Thead>
              <Th>Vendor</Th>
              <Th>Property</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th right>Amount</Th>
            </Thead>
            <Tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <RowLink href={`/bills/${b.id}`} sub={[b.invoice_number && `Invoice ${b.invoice_number}`, b.work_order && `WO #${b.work_order.number}`].filter(Boolean).join(" · ") || undefined}>
                      {b.vendorName}
                    </RowLink>
                  </Td>
                  <Td className="text-[13px]">{b.property?.name ?? "—"}</Td>
                  <Td className={`text-[13px] ${b.due_date && b.due_date < today && b.status !== "paid" && b.status !== "void" ? "font-semibold text-danger" : ""}`}>{date(b.due_date)}</Td>
                  <Td>
                    <Pill tone={BILL_STATUS[b.status]?.tone ?? "neutral"}>{BILL_STATUS[b.status]?.label ?? b.status}</Pill>
                  </Td>
                  <Td right>{money(b.amount_cents)}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No bills here">Invoices vendors upload from their job link land here for approval.</EmptyState>
        )}
      </Card>
    </>
  );
}
