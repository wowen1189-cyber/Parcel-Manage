import Link from "next/link";
import { buttonClass, Card, EmptyState, PageHeader, Pill } from "@/components/ui";
import { exportLink, ListFilters, param } from "@/components/list-filters";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { date } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { listWorkOrders } from "@/lib/work-order-list";
import { formatWhen, WO_PRIORITY, WO_STATUS } from "@/lib/work-orders";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  const { supabase, company } = await requireCompany();
  const sp = await searchParams;
  const filters = { q: param(sp, "q"), view: param(sp, "view") || "open", priority: param(sp, "priority"), property: param(sp, "property") };
  const [orders, { data: properties }] = await Promise.all([
    listWorkOrders(supabase, company.id, filters),
    supabase.from("property").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const tz = company.time_zone;

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Work orders from request to completion, with who's assigned and when."
        action={
          <Link href="/maintenance/new" className={buttonClass("primary", true)}>
            + New work order
          </Link>
        }
      />
      <div className="mb-4 flex gap-2">
        {[
          ["open", "Open"],
          ["completed", "Completed"],
          ["all", "All"],
        ].map(([v, label]) => (
          <Link key={v} href={exportLink("/maintenance", { ...filters, view: v === "open" ? "" : v })} className={buttonClass(filters.view === v ? "primary" : "secondary", true)}>
            {label}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden">
        <ListFilters
          action="/maintenance"
          search={filters.q}
          searchPlaceholder="Search by number, issue, property or vendor"
          selects={[
            { name: "priority", label: "Priority", value: filters.priority, options: Object.entries(WO_PRIORITY).map(([k, v]) => [k, v.label]) },
            { name: "property", label: "Property", value: filters.property, options: (properties ?? []).map((p) => [p.id, p.name]) },
            { name: "view", label: "Show", value: filters.view === "open" ? "" : filters.view, options: [["completed", "Completed"], ["all", "All"]] },
          ]}
          exportHref={exportLink("/maintenance/export", filters)}
          count={orders.length}
          noun={["work order", "work orders"]}
        />
        {!orders.length ? (
          <EmptyState title={filters.view === "open" ? "No open work orders" : "No work orders match"}>
            {filters.view === "open" ? "New requests from calls, emails and the tenant portal will show up here." : "Try a different search or clear the filters."}
          </EmptyState>
        ) : (
          <Table minWidth={900}>
            <Thead>
              <Th>Work order</Th>
              <Th>Where</Th>
              <Th>Priority</Th>
              <Th>Status</Th>
              <Th>Who</Th>
              <Th>When</Th>
            </Thead>
            <Tbody>
              {orders.map((w) => (
                <tr key={w.id}>
                  <Td>
                    <RowLink href={`/maintenance/${w.id}`} sub={`#${w.number} · opened ${date(w.created_at)}`}>
                      {w.title}
                    </RowLink>
                  </Td>
                  <Td>{w.where}</Td>
                  <Td>
                    <Pill tone={WO_PRIORITY[w.priority]?.tone ?? "neutral"}>{WO_PRIORITY[w.priority]?.label ?? w.priority}</Pill>
                  </Td>
                  <Td>
                    <Pill tone={WO_STATUS[w.status]?.tone ?? "neutral"}>{WO_STATUS[w.status]?.label ?? w.status}</Pill>
                  </Td>
                  <Td className="text-[13px]">{w.vendorName ?? <span className="font-semibold text-warn">Not assigned</span>}</Td>
                  <Td className="text-[13px]">{w.status === "completed" ? `Done ${date(w.completed_at)}` : w.scheduled_start ? formatWhen(w.scheduled_start, tz) : <span className="text-subtle">Not scheduled</span>}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
