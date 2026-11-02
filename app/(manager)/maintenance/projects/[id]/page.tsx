import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, CardHeader, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { BILL_STATUS } from "@/lib/bills";
import { contactName, date, money } from "@/lib/format";
import { PO_STATUS, poBilled, PROJECT_STATUS, projectTotals } from "@/lib/projects";
import { requireCompany } from "@/lib/session";
import { setPurchaseOrderStatus } from "../actions";
import { NewPurchaseOrderForm, ProjectSettingsForm } from "../forms";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/maintenance/projects/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: p } = await supabase
    .from("project")
    .select("id, name, status, budget_cents, start_on, target_on, notes, property(name), unit(label), purchase_order(id, number, description, amount_cents, status, approved_at, vendor(contact(kind, first_name, last_name, business_name))), bill(id, amount_cents, status, invoice_date, memo, purchase_order_id, vendor(contact(kind, first_name, last_name, business_name)))")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!p) notFound();
  const { data: vendors } = await supabase.from("vendor").select("id, contact(kind, first_name, last_name, business_name)").eq("company_id", company.id).eq("is_active", true);
  const canEdit = ["admin", "property_manager", "maintenance", "accountant"].includes(membership.role);
  const canApprove = ["admin", "property_manager", "accountant"].includes(membership.role);
  const t = projectTotals(p.budget_cents, p.purchase_order, p.bill);
  const pos = [...p.purchase_order].sort((a, b) => b.number - a.number);
  const action = (poId: string, to: string, label: string, variant: "primary" | "secondary" | "ghost" = "ghost") => (
    <form action={setPurchaseOrderStatus}>
      <input type="hidden" name="id" value={poId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" small variant={variant}>
        {label}
      </Button>
    </form>
  );

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance/projects" className="font-semibold text-accent hover:underline">
          ← Projects & purchase orders
        </Link>
      </p>
      <PageHeader title={p.name} subtitle={`${p.property.name}${p.unit ? ` · ${p.unit.label}` : ""}${p.start_on ? ` · started ${date(p.start_on)}` : ""}`} action={<Pill tone={p.status === "active" ? "info" : p.status === "done" ? "success" : "neutral"}>{PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS]}</Pill>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatTile label="Budget" value={money(p.budget_cents)} />
        <StatTile label="Spent" value={money(t.spent)} note="Bills approved or paid" />
        <StatTile label="Committed" value={money(t.committed)} note="Approved POs not billed yet" />
        <StatTile label={t.over ? "Over budget" : "Left"} value={money(Math.abs(t.left))} />
      </div>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Purchase orders" description="A PO counts against the budget once approved. Tie the vendor's bill to it in Bills when it comes in." />
          {pos.length ? (
            <Table minWidth={820}>
              <Thead>
                <Th>PO</Th>
                <Th>Vendor and what for</Th>
                <Th right>Amount</Th>
                <Th right>Billed</Th>
                <Th>Status</Th>
                <Th />
              </Thead>
              <Tbody>
                {pos.map((po) => {
                  const b = poBilled(po, p.bill);
                  return (
                    <tr key={po.id}>
                      <Td className="font-semibold">PO-{po.number}</Td>
                      <Td>
                        <p className="font-semibold">{contactName(po.vendor.contact)}</p>
                        <p className="text-[13px] text-subtle">{po.description}</p>
                      </Td>
                      <Td right>{money(po.amount_cents)}</Td>
                      <Td right>{money(b.billed)}</Td>
                      <Td>
                        <Pill tone={po.status === "approved" ? "success" : po.status === "draft" ? "warn" : "neutral"}>{PO_STATUS[po.status as keyof typeof PO_STATUS]}</Pill>
                      </Td>
                      <Td right>
                        <span className="flex justify-end gap-1">
                          {po.status === "draft" && canApprove && action(po.id, "approved", "Approve", "secondary")}
                          {po.status === "approved" && canEdit && action(po.id, "closed", "Close")}
                          {["draft", "approved"].includes(po.status) && canEdit && action(po.id, "void", "Void")}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No purchase orders yet" />
          )}
          {canEdit && p.status !== "done" && p.status !== "canceled" && <NewPurchaseOrderForm projectId={p.id} vendors={(vendors ?? []).map((x) => ({ id: x.id, name: contactName(x.contact) })).sort((a, b) => a.name.localeCompare(b.name))} />}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Bills" description="Bills tied to this project or its purchase orders (choose the PO when entering a bill)." />
          {p.bill.length ? (
            <ul className="divide-y divide-line">
              {p.bill.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <Link href={`/bills/${b.id}`} className="font-semibold text-accent hover:underline">
                    {contactName(b.vendor?.contact)} · {b.memo ?? "Bill"}
                  </Link>
                  <span>
                    {money(b.amount_cents)} <Pill tone={BILL_STATUS[b.status]?.tone ?? "neutral"}>{BILL_STATUS[b.status]?.label ?? b.status}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No bills yet" />
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardHeader title="Project" />
            <ProjectSettingsForm id={p.id} status={p.status} budget={(p.budget_cents / 100).toFixed(2)} targetOn={p.target_on ?? ""} />
          </Card>
        )}
      </div>
    </>
  );
}
