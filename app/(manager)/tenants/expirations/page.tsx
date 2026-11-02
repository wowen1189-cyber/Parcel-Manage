import Link from "next/link";
import { AutoSubmitForm, ClickRow } from "@/components/click-row";
import { Card, CardHeader, EmptyState, PageHeader, Pill, buttonClass, Field, Input, Select } from "@/components/ui";
import { RowLink, Table, Tbody, Td, Th, Thead } from "@/components/table";
import { param } from "@/components/list-filters";
import { readBusinessRules } from "@/lib/business-rules";
import { contactName, date, daysBetween, money, todayIn } from "@/lib/format";
import { addMonths, calendar, countExpirations, monthLabel, monthOf, recommendTerms, type LeaseEnd, type MonthCell } from "@/lib/lease-expirations";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Lease expirations" };

const HORIZON = 24;

export default async function ExpirationsPage({ searchParams }: PageProps<"/tenants/expirations">) {
  const { supabase, company } = await requireCompany();
  const params = await searchParams;
  const rules = readBusinessRules(company.settings);
  const today = todayIn(company.time_zone);
  const thisMonth = monthOf(today);

  const [{ data: properties }, { data: leases }] = await Promise.all([
    supabase.from("property").select("id, name, unit(id)").eq("company_id", company.id).order("name"),
    supabase
      .from("lease")
      .select("id, status, start_date, end_date, move_out_on, rent_cents, unit!inner(id, label, property_id), lease_tenant(is_primary, contact(first_name, last_name, business_name))")
      .eq("company_id", company.id)
      .in("status", ["active", "notice"]),
  ]);
  const props = (properties ?? []).map((p) => ({ id: p.id, name: p.name, units: p.unit.length }));
  const unitsByProperty = new Map(props.map((p) => [p.id, p.units]));
  const portfolioUnits = props.reduce((s, p) => s + p.units, 0);
  const ends: LeaseEnd[] = (leases ?? []).map((l) => ({ leaseId: l.id, propertyId: l.unit.property_id, endDate: l.end_date, status: l.status, moveOutOn: l.move_out_on }));
  const counts = countExpirations(ends);
  const portfolioCells = calendar(counts.portfolio, portfolioUnits, thisMonth, HORIZON, rules);
  const overMonths = portfolioCells.filter((c) => c.over);
  const name = (l: NonNullable<typeof leases>[number]) => contactName([...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact) || "Tenant";

  // Renewals: leases ending within the renewal window, plus month-to-month tenants who could sign a lease.
  // Suggested one at a time, soonest first, each counting the suggestions before it so they don't pile into one month.
  const working = ends.map((e) => ({ ...e }));
  const renewals = (leases ?? [])
    .filter((l) => l.status === "active")
    .map((l) => {
      const daysLeft = l.end_date ? daysBetween(today, l.end_date) : null;
      return { l, daysLeft };
    })
    .filter(({ daysLeft }) => daysLeft == null || daysLeft <= rules.expirations.renewalOfferDays)
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .map(({ l, daysLeft }) => {
      const start = l.end_date && l.end_date >= today ? nextDay(l.end_date) : firstOfNextMonth(today);
      const options = recommendTerms({
        start,
        propertyId: l.unit.property_id,
        propertyUnits: unitsByProperty.get(l.unit.property_id) ?? 1,
        portfolioUnits,
        counts: countExpirations(working, l.id),
        rules,
      });
      const best = options.find((o) => o.recommended)!;
      const mine = working.find((w) => w.leaseId === l.id);
      if (mine) Object.assign(mine, { endDate: best.endDate, status: "active", moveOutOn: null });
      return { l, daysLeft, start, best };
    });

  // Term planner. Clicking a renewal loads that tenant here; clicking a length selects it.
  const planProperty = param(params, "property") || props[0]?.id || "";
  const planStart = /^\d{4}-\d{2}-\d{2}$/.test(param(params, "start")) ? param(params, "start") : firstOfNextMonth(today);
  const planRent = Number(param(params, "rent")) || 0;
  const plan = planProperty
    ? recommendTerms({ start: planStart, propertyId: planProperty, propertyUnits: unitsByProperty.get(planProperty) ?? 1, portfolioUnits, counts: countExpirations(ends, param(params, "lease") || undefined), rules })
    : [];
  const renewing = (leases ?? []).find((l) => l.id === param(params, "lease") && l.unit.property_id === planProperty) ?? null;
  const picked = plan.find((o) => o.months === Number(param(params, "months"))) ?? null;
  const planHref = (extra: Record<string, string | number>) => {
    const q = new URLSearchParams({ property: planProperty, start: planStart, ...(planRent ? { rent: String(planRent) } : {}), ...(renewing ? { lease: renewing.id } : {}) });
    for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
    return `/tenants/expirations?${q}#planner`;
  };

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader
        title="Lease expirations"
        subtitle={`Keeps move-outs spread out: at most ${rules.expirations.maxSharePercent}% of units ending in any month, avoiding ${rules.expirations.avoidMonths.join(", ") || "no months"}.`}
        action={
          <Link href="/settings/business-rules" className={buttonClass("secondary", true)}>
            Change these rules
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Next 24 months, all properties"
          description={`${portfolioUnits} units, so at most ${portfolioCells[0]?.cap ?? 0} leases should end in one month.`}
          action={overMonths.length ? <Pill tone="danger">{overMonths.length} month{overMonths.length === 1 ? "" : "s"} over the limit</Pill> : <Pill tone="success">Within limits</Pill>}
        />
        <div className="overflow-x-auto px-5 py-4">
          <Bars cells={portfolioCells} />
        </div>
        <Table minWidth={1100}>
          <Thead>
            <Th>Property</Th>
            {portfolioCells.map((c) => (
              <Th key={c.month} right className="px-1.5 text-[11px]">
                {monthLabel(c.month)}
              </Th>
            ))}
          </Thead>
          <Tbody>
            {props.map((p) => {
              const cells = calendar(counts.byProperty.get(p.id), p.units, thisMonth, HORIZON, rules);
              return (
                <ClickRow key={p.id} href={`/properties/${p.id}`}>
                  <Td>
                    <RowLink href={`/properties/${p.id}`} sub={`${p.units} unit${p.units === 1 ? "" : "s"} · limit ${cells[0]?.cap}/month`}>
                      {p.name}
                    </RowLink>
                  </Td>
                  {cells.map((c) => (
                    <Td key={c.month} right className="px-1.5">
                      <Cell cell={c} />
                    </Td>
                  ))}
                </ClickRow>
              );
            })}
          </Tbody>
        </Table>
        <p className="border-t border-line px-5 py-3 text-[13px] text-subtle">
          Counts are leases ending (or moving out) that month. Month-to-month tenants have no end date and aren&apos;t counted. <span className="font-semibold text-danger">Red</span> is over
          the limit; shaded months are ones to avoid.
        </p>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Renewals to offer" description={`Leases ending within ${rules.expirations.renewalOfferDays} days, and month-to-month tenants. The suggested length keeps the calendar balanced. Click a tenant to plan their renewal.`} />
          {renewals.length ? (
            <Table minWidth={560}>
              <Thead>
                <Th>Tenant</Th>
                <Th>Ends</Th>
                <Th>Suggested renewal</Th>
              </Thead>
              <Tbody>
                {renewals.map(({ l, daysLeft, start, best }) => (
                  <ClickRow
                    key={l.id}
                    selected={renewing?.id === l.id}
                    href={`/tenants/expirations?${new URLSearchParams({ property: l.unit.property_id, start, rent: (l.rent_cents / 100).toFixed(2), lease: l.id, months: String(best.months) })}#planner`}
                  >
                    <Td>
                      <RowLink href={`/tenants/${l.id}`} sub={l.unit.label}>
                        {name(l)}
                      </RowLink>
                    </Td>
                    <Td className="text-[13px]">{l.end_date ? `${date(l.end_date)} (${daysLeft! < 0 ? "past" : `${daysLeft} days`})` : <Pill tone="info">Month-to-month</Pill>}</Td>
                    <Td>
                      <p className="font-semibold">{best.months} months</p>
                      <p className="text-[13px] text-subtle">
                        Ends {date(best.endDate)}
                        {best.status !== "good" && ` · ${best.reasons[0]}`}
                      </p>
                    </Td>
                  </ClickRow>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="No renewals due">No leases end within {rules.expirations.renewalOfferDays} days.</EmptyState>
          )}
        </Card>

        <Card className="overflow-hidden scroll-mt-20" id="planner">
          <CardHeader
            title="Lease length planner"
            description={renewing ? `Renewal for ${name(renewing)} (${renewing.unit.label}). Click a length to choose it.` : "For a new lease or renewal: which lengths keep move-outs spread out. Click a length to choose it."}
            action={
              renewing ? (
                <Link href={`/tenants/expirations?${new URLSearchParams({ property: planProperty, start: planStart })}#planner`} className="text-[13px] font-semibold text-muted hover:underline">
                  Clear tenant
                </Link>
              ) : undefined
            }
          />
          <AutoSubmitForm action="/tenants/expirations" className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-[1fr_150px_120px_auto] sm:items-end">
            {renewing && <input type="hidden" name="lease" value={renewing.id} />}
            <Field label="Property">
              <Select name="property" defaultValue={planProperty}>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starts">
              <Input type="date" name="start" defaultValue={planStart} />
            </Field>
            <Field label="Rent ($)">
              <Input name="rent" inputMode="decimal" defaultValue={planRent ? String(planRent) : ""} placeholder="Optional" />
            </Field>
            <button type="submit" className={buttonClass("secondary")}>
              Update
            </button>
          </AutoSubmitForm>
          <Table minWidth={560}>
            <Thead>
              <Th>Length</Th>
              <Th>Ends</Th>
              <Th>That month</Th>
              <Th right>Monthly rent</Th>
            </Thead>
            <Tbody>
              {plan.map((o) => (
                <ClickRow key={o.months} href={planHref({ months: o.months })} selected={picked?.months === o.months}>
                  <Td>
                    <Link href={planHref({ months: o.months })} scroll={false} className="font-semibold text-ink">
                      {o.months} months
                    </Link>{" "}
                    {o.recommended && <Pill tone="success">Best</Pill>}
                    {picked?.months === o.months && <span className="ml-1 text-[12px] font-semibold text-accent-deep">✓ Selected</span>}
                  </Td>
                  <Td className="text-[13px]">{date(o.endDate)}</Td>
                  <Td className="text-[13px]">
                    <Pill tone={o.status === "good" ? "success" : o.status === "avoid" ? "warn" : "danger"}>{o.status === "good" ? "Open" : o.status === "avoid" ? "Slow month" : "Full"}</Pill>
                    <p className="mt-1 text-subtle">
                      {o.propertyLoad}/{o.propertyCap} here · {o.portfolioLoad}/{o.portfolioCap} overall
                    </p>
                  </Td>
                  <Td right className="text-[13px]">
                    {planRent ? (
                      <>
                        {money(Math.round(planRent * 100) + o.surchargeCents)}
                        {o.surchargeCents > 0 && <p className="text-subtle">incl. {money(o.surchargeCents)} short-term</p>}
                        {o.months > 12 && <p className="text-subtle">+{rules.lease.longTermYearlyIncreasePercent}% after 12 months</p>}
                      </>
                    ) : o.surchargeCents > 0 ? (
                      `+${money(o.surchargeCents)}`
                    ) : o.months > 12 ? (
                      `+${rules.lease.longTermYearlyIncreasePercent}%/yr`
                    ) : (
                      "—"
                    )}
                  </Td>
                </ClickRow>
              ))}
            </Tbody>
          </Table>
          {picked && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-accent-softer px-5 py-4">
              <div className="text-[14px]">
                <p className="font-semibold">
                  {renewing ? `Renewal for ${name(renewing)}: ` : ""}
                  {picked.months} months, {date(planStart)} to {date(picked.endDate)}
                </p>
                <p className="text-muted">
                  {planRent ? `${money(Math.round(planRent * 100) + picked.surchargeCents)} a month` : "Rent not entered"}
                  {picked.surchargeCents > 0 && ` (includes ${money(picked.surchargeCents)} short-term)`}
                  {picked.months > 12 && `, then +${rules.lease.longTermYearlyIncreasePercent}% after 12 months`}
                </p>
              </div>
              {renewing ? (
                <Link href={`/tenants/${renewing.id}/renewal?months=${picked.months}`} className={buttonClass("primary", true)}>
                  Make a renewal offer
                </Link>
              ) : (
                <Link href={`/tenants/new?${new URLSearchParams({ start: planStart, months: String(picked.months), ...(planRent ? { rent: planRent.toFixed(2) } : {}) })}`} className={buttonClass("primary", true)}>
                  Start a lease with this
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Bars({ cells }: { cells: MonthCell[] }) {
  const max = Math.max(...cells.map((c) => Math.max(c.count, c.cap)), 1);
  return (
    <div className="flex min-w-[720px] items-end gap-1.5" role="img" aria-label="Leases ending per month for the next 24 months">
      {cells.map((c) => (
        <div key={c.month} className="flex flex-1 flex-col items-center gap-1">
          <span className={`tabular text-[11px] font-semibold ${c.over ? "text-danger" : "text-muted"}`}>{c.count || ""}</span>
          <div className={`relative h-24 w-full rounded-[4px] ${c.avoid ? "bg-surface-sunk" : "bg-surface-muted"}`}>
            <div className="absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: `${(c.cap / max) * 100}%` }} title={`Limit ${c.cap}`} />
            <div className={`absolute inset-x-0 bottom-0 rounded-[4px] ${c.over ? "bg-danger" : "bg-accent"}`} style={{ height: `${(c.count / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-subtle">{monthLabel(c.month)}</span>
        </div>
      ))}
    </div>
  );
}

function Cell({ cell }: { cell: MonthCell }) {
  if (!cell.count) return <span className={`inline-block w-6 rounded py-0.5 text-center text-[12px] ${cell.avoid ? "bg-surface-sunk text-subtle" : "text-subtle"}`}>·</span>;
  return (
    <span className={`tabular inline-block w-6 rounded py-0.5 text-center text-[12px] font-semibold ${cell.over ? "bg-danger-bg text-danger" : cell.avoid ? "bg-warn-bg text-warn" : "bg-accent-softer text-accent-deep"}`}>
      {cell.count}
    </span>
  );
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function firstOfNextMonth(today: string): string {
  return `${addMonths(monthOf(today), 1)}-01`;
}
