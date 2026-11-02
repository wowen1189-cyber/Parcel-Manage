import Link from "next/link";
import type { ReactNode } from "react";
import { DashboardGrid } from "@/components/dashboard-grid";
import { Card, CardHeader, EmptyState, PageHeader, Pill, StatTile } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { readBusinessRules } from "@/lib/business-rules";
import { dashboardLayout, type DashboardPrefs } from "@/lib/dashboard-tiles";
import { date, money, todayIn } from "@/lib/format";
import { calendar, countExpirations, monthLabel, monthOf } from "@/lib/lease-expirations";
import { requireCompany } from "@/lib/session";
import { listTenants } from "@/lib/tenants";
import { listVendors } from "@/lib/vendor-list";
import { listWorkOrders } from "@/lib/work-order-list";
import { formatWhen, WO_PRIORITY } from "@/lib/work-orders";
import { nextDepositStep } from "@/lib/deposits";
import { contactName } from "@/lib/format";
import { saveDashboardLayout } from "../preferences";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, company, user } = await requireCompany();
  const today = todayIn(company.time_zone);
  const rules = readBusinessRules(company.settings);
  const [{ count: propertyCount }, { data: units }, leases, blockedVendors, { data: profile }, { data: leaseEnds }] = await Promise.all([
    supabase.from("property").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("unit").select("status").eq("company_id", company.id),
    listTenants(supabase, company.id, { q: "", property: "", show: "" }, today),
    listVendors(supabase, company.id, { q: "", trade: "", paperwork: "blocked" }, today),
    supabase.from("profile").select("preferences").eq("id", user.id).single(),
    supabase.from("lease").select("id, status, end_date, move_out_on, unit!inner(property_id)").eq("company_id", company.id).in("status", ["active", "notice"]),
  ]);
  const [workOrders, { data: moveOuts }, { data: bills }] = await Promise.all([
    listWorkOrders(supabase, company.id, { q: "", view: "open", priority: "", property: "" }),
    supabase.from("move_out").select("id, lease_id, vacated_on, decision, claim_notice_sent_on, claim_notice_method, lease(unit(label, property(name)), lease_tenant(is_primary, role, contact(kind, first_name, last_name, business_name)))").eq("company_id", company.id).is("closed_at", null),
    supabase.from("bill").select("id, amount_cents").eq("company_id", company.id).eq("status", "received"),
  ]);
  const depositRows = (moveOuts ?? [])
    .map((m) => {
      const { next, label, left } = nextDepositStep(m, today);
      const t = [...m.lease.lease_tenant].filter((x) => x.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
      return { id: m.id, leaseId: m.lease_id, name: contactName(t?.contact), where: m.lease.unit.property.name, next, label, left };
    })
    .sort((a, b) => a.next.localeCompare(b.next));
  const total = units?.length ?? 0;
  const occupied = units?.filter((u) => u.status === "occupied" || u.status === "notice").length ?? 0;
  const signed = leases.filter((l) => l.status !== "draft");
  const rent = signed.reduce((s, l) => s + l.rentCents, 0);
  const owing = leases.filter((l) => (l.balanceCents ?? 0) > 0).sort((a, b) => (b.balanceCents ?? 0) - (a.balanceCents ?? 0));
  const owed = owing.reduce((s, l) => s + (l.balanceCents ?? 0), 0);
  const ending = leases.filter((l) => l.timing.daysLeft != null && l.timing.daysLeft <= 90).sort((a, b) => (a.timing.daysLeft ?? 0) - (b.timing.daysLeft ?? 0));
  const counts = countExpirations((leaseEnds ?? []).map((l) => ({ leaseId: l.id, propertyId: l.unit.property_id, endDate: l.end_date, status: l.status, moveOutOn: l.move_out_on })));
  const months = calendar(counts.portfolio, total, monthOf(today), 12, rules);
  const busiest = Math.max(...months.map((m) => Math.max(m.count, m.cap)), 1);
  const prefs = (profile?.preferences ?? {}) as { dashboard?: DashboardPrefs };

  const viewAll = (href: string, label: string) => (
    <Link href={href} className="text-[13px] font-semibold text-accent hover:underline">
      {label}
    </Link>
  );

  const tiles: Record<string, ReactNode> = {
    "key-numbers": (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Occupancy" value={total ? `${Math.round((occupied / total) * 100)}%` : "—"} note={`${occupied} of ${total} units · ${propertyCount ?? 0} properties`} />
        <StatTile label="Monthly rent" value={money(rent)} note={`${signed.length} leases`} />
        <StatTile label="Owed by tenants" value={money(owed)} note={`${owing.length} tenants`} />
        <StatTile label="Vacant" value={total - occupied} note={total - occupied === 1 ? "unit" : "units"} />
      </div>
    ),
    owes: (
      <Card className="h-full overflow-hidden">
        <CardHeader title="Who owes the most" action={viewAll("/tenants?show=owes", `All ${owing.length}`)} />
        {owing.length ? (
          <Table minWidth={420}>
            <Thead>
              <Th>Tenant</Th>
              <Th right>Owes</Th>
            </Thead>
            <Tbody>
              {owing.slice(0, 6).map((l) => (
                <tr key={l.leaseId}>
                  <Td>
                    <RowLink href={`/tenants/${l.leaseId}`} sub={`${l.propertyName} · ${l.unitLabel}`}>
                      {l.name}
                    </RowLink>
                  </Td>
                  <Td right className="font-semibold text-danger">
                    {money(l.balanceCents)}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="Nobody owes anything" />
        )}
      </Card>
    ),
    ending: (
      <Card className="h-full overflow-hidden">
        <CardHeader title="Leases ending in 90 days" action={viewAll("/tenants/expirations", "Renewals")} />
        {ending.length ? (
          <Table minWidth={420}>
            <Thead>
              <Th>Tenant</Th>
              <Th>Ends</Th>
            </Thead>
            <Tbody>
              {ending.slice(0, 6).map((l) => (
                <tr key={l.leaseId}>
                  <Td>
                    <RowLink href={`/tenants/${l.leaseId}`} sub={`${l.propertyName} · ${l.unitLabel}`}>
                      {l.name}
                    </RowLink>
                  </Td>
                  <Td>
                    <Pill tone={l.timing.tone}>{l.timing.label}</Pill>
                    <p className="mt-1 text-[13px] text-subtle">{date(l.status === "notice" ? l.moveOutOn : l.endDate)}</p>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No leases end in the next 90 days" />
        )}
      </Card>
    ),
    expirations: (
      <Card className="h-full overflow-hidden">
        <CardHeader
          title="Lease expirations"
          description={`Next 12 months · limit ${months[0]?.cap ?? 0} a month`}
          action={viewAll("/tenants/expirations", "Calendar")}
        />
        <div className="flex items-end gap-1 px-5 py-4" role="img" aria-label="Leases ending per month for the next 12 months">
          {months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <span className={`tabular text-[11px] font-semibold ${m.over ? "text-danger" : "text-muted"}`}>{m.count || ""}</span>
              <div className={`relative h-20 w-full rounded-[4px] ${m.avoid ? "bg-surface-sunk" : "bg-surface-muted"}`}>
                <div className="absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: `${(m.cap / busiest) * 100}%` }} />
                <div className={`absolute inset-x-0 bottom-0 rounded-[4px] ${m.over ? "bg-danger" : "bg-accent"}`} style={{ height: `${(m.count / busiest) * 100}%` }} />
              </div>
              <span className="text-[10px] text-subtle">{monthLabel(m.month).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>
    ),
    vendors: (
      <Card className="h-full">
        <CardHeader title="Vendors missing paperwork" action={viewAll("/vendors?paperwork=blocked", "Fix")} />
        <div className="px-5 py-4 text-sm">
          {blockedVendors.length ? (
            <p>
              <span className="font-semibold">{blockedVendors.length} on-site vendors</span> can&apos;t be sent work orders until their W-9 and insurance are on file.
            </p>
          ) : (
            <p>All on-site vendors have their W-9 and insurance on file.</p>
          )}
        </div>
      </Card>
    ),
    deposits: (
      <Card className="h-full overflow-hidden">
        <CardHeader title="Deposit deadlines" description="Fla. Stat. 83.49(3) after each move-out." />
        {depositRows.length ? (
          <ul className="divide-y divide-line">
            {depositRows.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link href={`/tenants/${d.leaseId}/move-out`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                  <span>
                    <span className="block text-sm font-semibold">{d.name}</span>
                    <span className="text-[13px] text-subtle">
                      {d.label} · {d.where}
                    </span>
                  </span>
                  <Pill tone={d.left < 0 ? "danger" : d.left <= 5 ? "warn" : "neutral"}>{d.left < 0 ? `${-d.left} days late` : `${date(d.next)}`}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No deposits waiting" />
        )}
      </Card>
    ),
    bills: (
      <Card className="h-full">
        <CardHeader title="Bills to approve" action={viewAll("/bills?status=received", "Review")} />
        <div className="px-5 py-4 text-sm">
          {bills?.length ? (
            <p>
              <span className="font-semibold">{bills.length} bills</span> ({money(bills.reduce((s, b) => s + b.amount_cents, 0))}) are waiting for approval.
            </p>
          ) : (
            <p>No bills waiting for approval.</p>
          )}
        </div>
      </Card>
    ),
    "work-orders": (
      <Card className="h-full overflow-hidden">
        <CardHeader title="Open work orders" description="When each is scheduled and who it's assigned to." action={viewAll("/maintenance", `All ${workOrders.length}`)} />
        {workOrders.length ? (
          <Table minWidth={420}>
            <Thead>
              <Th>Work order</Th>
              <Th>Who · when</Th>
            </Thead>
            <Tbody>
              {workOrders.slice(0, 6).map((w) => (
                <tr key={w.id}>
                  <Td>
                    <RowLink href={`/maintenance/${w.id}`} sub={`#${w.number} · ${w.where}`}>
                      {w.title}
                    </RowLink>
                    <p className="mt-1">
                      <Pill tone={WO_PRIORITY[w.priority]?.tone ?? "neutral"}>{WO_PRIORITY[w.priority]?.label}</Pill>
                    </p>
                  </Td>
                  <Td className="text-[13px]">
                    <p>{w.vendorName ?? <span className="font-semibold text-warn">Not assigned</span>}</p>
                    <p className="text-subtle">{w.scheduled_start ? formatWhen(w.scheduled_start, company.time_zone) : "Not scheduled"}</p>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState title="No open work orders" />
        )}
      </Card>
    ),
  };

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Good to see you. Here's ${company.name} today.`} />
      <DashboardGrid layout={dashboardLayout(prefs.dashboard)} tiles={tiles} saveLayout={saveDashboardLayout} />
    </>
  );
}
