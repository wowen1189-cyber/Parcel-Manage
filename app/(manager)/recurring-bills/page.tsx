import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { EXPENSE_ACCOUNTS } from "@/lib/bills";
import { contactName, date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { toggleRecurringBill } from "./actions";
import { DueNowButton, NewRecurringForm } from "./forms";

export const metadata = { title: "Recurring bills" };

export default async function RecurringBillsPage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ data: rows }, { data: vendors }, { data: properties }] = await Promise.all([
    supabase.from("recurring_bill").select("id, amount_cents, memo, frequency, next_on, active, vendor(contact(kind, first_name, last_name, business_name)), property(name)").eq("company_id", company.id).order("next_on"),
    supabase.from("vendor").select("id, contact(kind, first_name, last_name, business_name)").eq("company_id", company.id).eq("is_active", true),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const canEdit = ["admin", "accountant", "property_manager"].includes(membership.role);
  return (
    <>
      <PageHeader title="Recurring bills" subtitle="Bills that repeat. Each one is created on its date and waits for approval in Bills." action={canEdit ? <DueNowButton /> : undefined} />
      <Card className="overflow-hidden">
        {rows?.length ? (
          <Table minWidth={760}>
            <Thead>
              <Th>What</Th>
              <Th>Property</Th>
              <Th>How often</Th>
              <Th>Next</Th>
              <Th right>Amount</Th>
              <Th />
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <p className="font-semibold">{r.memo}</p>
                    <p className="text-[13px] text-subtle">{contactName(r.vendor.contact)}</p>
                  </Td>
                  <Td className="text-[13px]">{r.property.name}</Td>
                  <Td className="text-[13px]">{r.frequency === "quarterly" ? "Every 3 months" : r.frequency === "yearly" ? "Yearly" : "Monthly"}</Td>
                  <Td className="text-[13px]">{r.active ? date(r.next_on) : <Pill>Paused</Pill>}</Td>
                  <Td right>{money(r.amount_cents)}</Td>
                  <Td>
                    {canEdit && (
                      <form action={toggleRecurringBill}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                        <button className="text-[13px] font-semibold text-accent">{r.active ? "Pause" : "Resume"}</button>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No recurring bills yet" />
        )}
      </Card>
      {canEdit && (
        <Card className="mt-6">
          <CardHeader title="Add a recurring bill" />
          <div className="px-5 py-4">
            <NewRecurringForm
              vendors={(vendors ?? []).map((v) => ({ id: v.id, name: contactName(v.contact) })).sort((a, b) => a.name.localeCompare(b.name))}
              properties={properties ?? []}
              accounts={EXPENSE_ACCOUNTS}
              today={todayIn(company.time_zone)}
            />
          </div>
        </Card>
      )}
    </>
  );
}
