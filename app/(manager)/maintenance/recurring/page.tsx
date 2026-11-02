import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { contactName, date, todayIn } from "@/lib/format";
import { MAINTENANCE_FREQUENCY } from "@/lib/recurring-maintenance-rules";
import { requireCompany } from "@/lib/session";
import { deleteSchedule, toggleSchedule } from "./actions";
import { DueNowButton, NewScheduleForm } from "./forms";

export const metadata = { title: "Recurring maintenance" };

export default async function RecurringMaintenancePage() {
  const { supabase, company, membership } = await requireCompany();
  const [{ data: rows }, { data: properties }, { data: vendors }] = await Promise.all([
    supabase
      .from("recurring_work_order")
      .select("id, title, frequency, next_on, active, last_work_order_id, property(name), unit(label), vendor(contact(kind, first_name, last_name, business_name)), work_order:last_work_order_id(number)")
      .eq("company_id", company.id)
      .order("next_on"),
    supabase.from("property").select("id, name, unit(id, label)").eq("company_id", company.id).order("name"),
    supabase.from("vendor").select("id, contact(kind, first_name, last_name, business_name)").eq("company_id", company.id).eq("is_active", true),
  ]);
  const canEdit = ["admin", "property_manager", "maintenance"].includes(membership.role);
  const today = todayIn(company.time_zone);
  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance" className="font-semibold text-accent hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader title="Recurring maintenance" subtitle="Work that repeats: AC filters, pest control, gutters, extinguisher checks. Each date creates a work order for you to assign and schedule." action={canEdit ? <DueNowButton /> : undefined} />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          {rows?.length ? (
            <Table minWidth={760}>
              <Thead>
                <Th>What</Th>
                <Th>Where</Th>
                <Th>How often</Th>
                <Th>Next</Th>
                <Th>Last work order</Th>
                <Th />
              </Thead>
              <Tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <p className="font-semibold">{r.title}</p>
                      {r.vendor && <p className="text-[13px] text-subtle">{contactName(r.vendor.contact)}</p>}
                    </Td>
                    <Td className="text-[13px]">
                      {r.property.name}
                      {r.unit ? ` · ${r.unit.label}` : ""}
                    </Td>
                    <Td className="text-[13px]">{MAINTENANCE_FREQUENCY[r.frequency as keyof typeof MAINTENANCE_FREQUENCY]}</Td>
                    <Td className="text-[13px]">{r.active ? date(r.next_on) : <Pill>Paused</Pill>}</Td>
                    <Td className="text-[13px]">
                      {r.last_work_order_id && r.work_order ? (
                        <Link href={`/maintenance/${r.last_work_order_id}`} className="font-semibold text-accent hover:underline">
                          #{r.work_order.number}
                        </Link>
                      ) : (
                        <span className="text-subtle">None yet</span>
                      )}
                    </Td>
                    <Td>
                      {canEdit && (
                        <span className="flex gap-3">
                          <form action={toggleSchedule}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="active" value={r.active ? "0" : "1"} />
                            <button className="min-h-10 text-[13px] font-semibold text-accent">{r.active ? "Pause" : "Resume"}</button>
                          </form>
                          <form action={deleteSchedule}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="min-h-10 text-[13px] font-semibold text-danger">Remove</button>
                          </form>
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No recurring maintenance yet">Add AC filter changes, pest control and other repeating work below.</EmptyState>
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardHeader title="Add a schedule" />
            <NewScheduleForm
              properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name, units: p.unit.map((u) => ({ id: u.id, label: u.label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) }))}
              vendors={(vendors ?? []).map((x) => ({ id: x.id, name: contactName(x.contact) })).sort((a, b) => a.name.localeCompare(b.name))}
              today={today}
            />
          </Card>
        )}
      </div>
    </>
  );
}
