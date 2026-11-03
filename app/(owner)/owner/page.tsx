import Link from "next/link";
import { Card, CardHeader, EmptyState, Pill, StatTile } from "@/components/ui";
import { date, money } from "@/lib/format";
import { requireOwner } from "@/lib/portal";

export const metadata = { title: "Overview" };

export default async function OwnerHome() {
  const { supabase, company, owners } = await requireOwner();
  const ids = owners.map((o) => o.id);
  const [{ data: statements }, { data: payouts }] = await Promise.all([
    supabase.from("owner_statement").select("id, entity_id, period_start, totals, sent_at").in("entity_id", ids).order("period_start", { ascending: false }).limit(24),
    supabase.from("owner_distribution").select("id, entity_id, payee_name, amount_cents, status, paid_on").in("entity_id", ids).order("created_at", { ascending: false }).limit(24),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">Your properties with {company.name}</h1>
        <Link href="/owner/documents" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-sm font-semibold">
          Documents
        </Link>
      </div>
      {owners.map((o) => {
        const units = o.property.flatMap((p) => p.unit);
        const occupied = units.filter((u) => u.status === "occupied" || u.status === "notice").length;
        const st = (statements ?? []).filter((s) => s.entity_id === o.id);
        const dist = (payouts ?? []).filter((d) => d.entity_id === o.id);
        return (
          <section key={o.id} className="space-y-4">
            <h2 className="text-[20px] font-bold">{o.name}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Properties" value={o.property.length} note={o.property.map((p) => p.name).join(", ")} />
              <StatTile label="Occupancy" value={units.length ? `${Math.round((occupied / units.length) * 100)}%` : "—"} note={`${occupied} of ${units.length} units`} />
              <StatTile label="Last distribution" value={dist[0] ? money(dist[0].amount_cents) : "—"} note={dist[0] ? (dist[0].status === "paid" ? `Paid ${date(dist[0].paid_on)}` : "Pending") : undefined} />
            </div>
            <Card className="overflow-hidden">
              <CardHeader title="Monthly statements" />
              {st.length ? (
                <ul className="divide-y divide-line">
                  {st.map((s) => (
                    <li key={s.id}>
                      <Link href={`/owner/statements/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                        <span className="font-semibold">{new Date(`${s.period_start}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
                        <Pill tone="success">Distribution {money((s.totals as { distributableCents: number }).distributableCents)}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No statements yet" />
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
