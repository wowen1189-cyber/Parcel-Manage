import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date, money, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { returnKey } from "./actions";
import { AddItemForm, AddKeyForm, CheckOutForm, StockForm } from "./forms";

export const metadata = { title: "Keys & inventory" };

export default async function KeysPage() {
  const { supabase, company, membership } = await requireCompany();
  const today = todayIn(company.time_zone);
  const [{ data: keys }, { data: items }, { data: properties }] = await Promise.all([
    supabase.from("key_set").select("id, label, tag, copies, location, property(name), unit(label), key_checkout(id, holder, out_at, due_back_on, returned_at)").eq("company_id", company.id).order("created_at"),
    supabase.from("inventory_item").select("id, name, location, quantity, reorder_at, unit_cost_cents").eq("company_id", company.id).order("name"),
    supabase.from("property").select("id, name, unit(id, label)").eq("company_id", company.id).order("name"),
  ]);
  const canEdit = ["admin", "property_manager", "maintenance", "leasing_agent"].includes(membership.role);
  const sorted = [...(keys ?? [])].sort((a, b) => a.property.name.localeCompare(b.property.name) || (a.unit?.label ?? "").localeCompare(b.unit?.label ?? "", undefined, { numeric: true }));
  const out = sorted.filter((k) => k.key_checkout.some((c) => !c.returned_at)).length;
  const low = (items ?? []).filter((i) => i.reorder_at > 0 && i.quantity <= i.reorder_at).length;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance" className="font-semibold text-accent hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader title="Keys & inventory" subtitle={`${out} key${out === 1 ? "" : "s"} out now · ${low} item${low === 1 ? "" : "s"} to reorder`} />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Keys" description="Who has which key, and when it's due back. Door and lockbox codes don't go here; keep them in the unit's access notes." />
          {sorted.length ? (
            <Table minWidth={860}>
              <Thead>
                <Th>Key</Th>
                <Th>Tag</Th>
                <Th>Kept</Th>
                <Th>Now</Th>
                <Th />
              </Thead>
              <Tbody>
                {sorted.map((k) => {
                  const open = k.key_checkout.find((c) => !c.returned_at);
                  const late = open?.due_back_on && open.due_back_on < today;
                  return (
                    <tr key={k.id}>
                      <Td>
                        <p className="font-semibold">{k.label}</p>
                        <p className="text-[13px] text-subtle">
                          {k.property.name}
                          {k.unit ? ` · ${k.unit.label}` : ""}
                        </p>
                      </Td>
                      <Td className="text-[13px]">{k.tag ?? "—"}</Td>
                      <Td className="text-[13px]">
                        {k.copies} {k.copies === 1 ? "copy" : "copies"}
                        {k.location ? ` · ${k.location}` : ""}
                      </Td>
                      <Td className="text-[13px]">
                        {open ? (
                          <>
                            <Pill tone={late ? "danger" : "warn"}>{late ? "Overdue" : "Out"}</Pill> {open.holder} since {date(open.out_at.slice(0, 10))}
                            {open.due_back_on ? `, due ${date(open.due_back_on)}` : ""}
                          </>
                        ) : (
                          <Pill tone="success">In</Pill>
                        )}
                      </Td>
                      <Td right>
                        {canEdit &&
                          (open ? (
                            <form action={returnKey}>
                              <input type="hidden" name="id" value={open.id} />
                              <button className="min-h-10 text-[13px] font-semibold text-accent">Mark returned</button>
                            </form>
                          ) : (
                            <CheckOutForm keySetId={k.id} today={today} />
                          ))}
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No keys yet" />
          )}
          {canEdit && <AddKeyForm properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name, units: p.unit.map((u) => ({ id: u.id, label: u.label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) }))} />}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Inventory" description="Supplies kept on hand. Record what's used on a work order by its number." />
          {items?.length ? (
            <Table minWidth={860}>
              <Thead>
                <Th>Item</Th>
                <Th right>On hand</Th>
                <Th right>Cost each</Th>
                <Th>Status</Th>
                <Th />
              </Thead>
              <Tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <p className="font-semibold">{i.name}</p>
                      {i.location && <p className="text-[13px] text-subtle">{i.location}</p>}
                    </Td>
                    <Td right>{i.quantity}</Td>
                    <Td right>{i.unit_cost_cents ? money(i.unit_cost_cents) : "—"}</Td>
                    <Td>{i.reorder_at > 0 && i.quantity <= i.reorder_at ? <Pill tone="warn">Reorder</Pill> : <Pill tone="success">OK</Pill>}</Td>
                    <Td right>{canEdit && <StockForm itemId={i.id} />}</Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No inventory yet" />
          )}
          {canEdit && <AddItemForm />}
        </Card>
      </div>
    </>
  );
}
