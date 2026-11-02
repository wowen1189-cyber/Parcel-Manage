import Link from "next/link";
import { buttonClass, Card, CardHeader, EmptyState, Notice, Pill } from "@/components/ui";
import { date, money, oneLineAddress, todayIn } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { requireTenant } from "@/lib/portal";
import { WO_STATUS } from "@/lib/work-orders";

export const metadata = { title: "Home" };

export default async function PortalHome() {
  const { supabase, company, lease } = await requireTenant();
  const [{ data: charges }, { data: payments }, { data: full }, { data: requests }] = await Promise.all([
    supabase.from("charge").select("id, charge_type, description, amount_cents, due_date, created_at").eq("lease_id", lease.id),
    supabase.from("payment").select("id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at").eq("lease_id", lease.id),
    supabase.from("lease").select("opening_balance_cents, opening_balance_as_of").eq("id", lease.id).single(),
    supabase.from("work_order").select("id, number, title, status, created_at").eq("unit_id", lease.unit.id).neq("status", "completed").neq("status", "canceled").order("created_at", { ascending: false }).limit(5),
  ]);
  const { balanceCents } = buildLedger(charges ?? [], payments ?? [], { cents: full?.opening_balance_cents ?? null, asOf: full?.opening_balance_as_of ?? null });
  const phone = company.office_phone;
  const { data: renewalOpen } = await supabase.from("renewal_offer").select("respond_by").eq("lease_id", lease.id).eq("status", "sent").gte("respond_by", todayIn(company.time_zone)).order("sent_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.01em]">{lease.unit.property.name}</h1>
        <p className="text-muted">{oneLineAddress({ ...lease.unit.property, address_line2: [lease.unit.property.address_line2, lease.unit.label !== "Home" ? `Unit ${lease.unit.label}` : null].filter(Boolean).join(", ") })}</p>
      </div>

      {renewalOpen && (
        <Link href="/portal/renewal" className="block rounded-[var(--radius-card)] border border-accent bg-accent-softer px-5 py-4 hover:bg-accent-soft">
          <p className="font-bold text-accent-deep">Your renewal options are ready</p>
          <p className="text-[14px] text-muted">Choose one by {date(renewalOpen.respond_by)}.</p>
        </Link>
      )}
      <Card className="p-5">
        <p className="text-[13px] font-semibold text-subtle">{balanceCents < 0 ? "Credit on your account" : "You owe"}</p>
        <p className={`mt-1 text-[34px] font-extrabold ${balanceCents > 0 ? "text-danger" : ""}`}>{money(Math.abs(balanceCents))}</p>
        <p className="text-[14px] text-muted">Rent {money(lease.rent_cents)} a month, due on the 1st.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal/pay" className={buttonClass("primary")}>
            Pay rent
          </Link>
          <Link href="/portal/payments" className={buttonClass("secondary")}>
            See my ledger
          </Link>
        </div>
      </Card>

      <Notice tone="danger">
        <span className="font-semibold">Smell gas or see smoke, fire or sparks?</span> Leave now and call 911, then{" "}
        <Link href="/portal/maintenance/new" className="font-semibold underline">
          report it here
        </Link>
        {phone ? ` or call ${phone}` : ""}.
      </Notice>

      <Card>
        <CardHeader title="Repair requests" action={<Link href="/portal/maintenance/new" className={buttonClass("primary", true)}>+ New request</Link>} />
        {requests?.length ? (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/portal/maintenance/${r.id}`} className="flex min-h-14 items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
                  <span>
                    <span className="block font-semibold">{r.title}</span>
                    <span className="text-[13px] text-subtle">#{r.number} · {date(r.created_at.slice(0, 10))}</span>
                  </span>
                  <Pill tone={WO_STATUS[r.status]?.tone ?? "neutral"}>{WO_STATUS[r.status]?.label ?? r.status}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No open requests">Something not working? Start a request and we&apos;ll walk you through it.</EmptyState>
        )}
      </Card>

      <Card className="p-5 text-[14px] text-muted">
        Your lease runs {date(lease.start_date)} to {lease.end_date ? date(lease.end_date) : "month to month"}.{" "}
        <Link href="/portal/lease" className="font-semibold text-accent underline">
          See your lease details
        </Link>
        .
      </Card>
    </div>
  );
}
