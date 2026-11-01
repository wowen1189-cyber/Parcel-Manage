import Link from "next/link";
import { buttonClass, Card, EmptyState, Pill } from "@/components/ui";
import { date } from "@/lib/format";
import { requireTenant } from "@/lib/portal";
import { WO_STATUS } from "@/lib/work-orders";

export const metadata = { title: "Repairs" };

export default async function RequestsPage() {
  const { supabase, lease } = await requireTenant();
  const { data: requests } = await supabase.from("work_order").select("id, number, title, status, priority, created_at, completed_at").eq("unit_id", lease.unit.id).order("created_at", { ascending: false });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">Repairs</h1>
        <Link href="/portal/maintenance/new" className={buttonClass("primary")}>
          + New request
        </Link>
      </div>
      <Card>
        {requests?.length ? (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/portal/maintenance/${r.id}`} className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                  <span>
                    <span className="block font-semibold">{r.title}</span>
                    <span className="text-[13px] text-subtle">
                      #{r.number} · {r.completed_at ? `fixed ${date(r.completed_at.slice(0, 10))}` : `sent ${date(r.created_at.slice(0, 10))}`}
                    </span>
                  </span>
                  <Pill tone={WO_STATUS[r.status]?.tone ?? "neutral"}>{WO_STATUS[r.status]?.label ?? r.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No requests yet" />
        )}
      </Card>
    </div>
  );
}
