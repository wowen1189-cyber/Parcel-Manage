import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, company } = await requireCompany();
  const [{ count: propertyCount }, { data: units }] = await Promise.all([
    supabase.from("property").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("unit").select("status, market_rent_cents").eq("company_id", company.id),
  ]);
  const total = units?.length ?? 0;
  const occupied = units?.filter((u) => u.status === "occupied").length ?? 0;
  const vacant = units?.filter((u) => u.status === "vacant" || u.status === "listed").length ?? 0;
  const occupancy = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Good to see you. Here's ${company.name} today.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Properties" value={propertyCount ?? 0} />
        <StatTile label="Units" value={total} />
        <StatTile label="Occupancy" value={`${occupancy}%`} note={`${occupied} of ${total} units occupied`} />
        <StatTile label="Vacant or listed" value={vacant} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Collections this month" description="Rent charged, collected and who's late." />
          <EmptyState title="Starts in Phase 1">Once rent posts, you&apos;ll see collections and the delinquent list here.</EmptyState>
        </Card>
        <Card>
          <CardHeader title="Open work orders" description="When each is scheduled and who it's assigned to." />
          <EmptyState title="Starts in Phase 1">Maintenance requests from the tenant portal will show up here.</EmptyState>
        </Card>
      </div>
      <p className="mt-6 text-[13px] text-subtle">
        Movable, resizable tiles arrive in Phase 1. Meanwhile, see your <Link href="/properties" className="font-semibold text-accent hover:underline">properties</Link>.
      </p>
    </>
  );
}
