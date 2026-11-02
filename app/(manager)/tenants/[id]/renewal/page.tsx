import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill, buttonClass } from "@/components/ui";
import { param } from "@/components/list-filters";
import { contactName, date, money, todayIn } from "@/lib/format";
import { choiceSchema, describeChoice } from "@/lib/renewal-offers";
import { renewalContext } from "@/lib/renewal-offers-data";
import { requireCompany } from "@/lib/session";
import { applyRenewalChoice, withdrawRenewalOffer } from "./actions";
import { RenewalOfferForm } from "./offer-form";

export const metadata = { title: "Renewal offer" };

const STATUS: Record<string, { label: string; tone: "info" | "success" | "warn" | "neutral" }> = {
  sent: { label: "Waiting for the tenant", tone: "info" },
  accepted: { label: "Tenant chose an option", tone: "success" },
  declined: { label: "Tenant declined", tone: "warn" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  applied: { label: "Applied to the lease", tone: "success" },
};

// One lease's renewal offer: build and send it, see the tenant's answer, and apply their choice.
export default async function RenewalOfferPage({ params, searchParams }: PageProps<"/tenants/[id]/renewal">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company } = await requireCompany();
  const today = todayIn(company.time_zone);
  const ctx = await renewalContext(supabase, company, id, today);
  if (!ctx) notFound();
  const { lease, rules, start, plan } = ctx;
  const { data: offers } = await supabase.from("renewal_offer").select("id, status, options, increase_percent, respond_by, sent_at, sent_to, chosen_option, responded_at").eq("company_id", company.id).eq("lease_id", id).order("sent_at", { ascending: false }).limit(5);
  const tenant = contactName([...lease.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact) || "Tenant";
  const latest = offers?.[0];
  const best = plan.find((o) => o.recommended);
  const asked = param(sp, "months");
  const first = plan.some((o) => String(o.months) === asked) ? asked : String(best?.months ?? 12);
  const second = plan.find((o) => o.months === 12 && String(o.months) !== first) ? "12" : String(plan.find((o) => o.status === "good" && String(o.months) !== first)?.months ?? "");
  // Answer by: 30 days before the lease ends, or two weeks from today if that's sooner than a week away.
  const thirtyBefore = lease.end_date ? new Date(new Date(`${lease.end_date}T00:00:00Z`).getTime() - 30 * 86_400_000).toISOString().slice(0, 10) : "";
  const weekOut = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const respondBy = thirtyBefore && thirtyBefore > weekOut ? thirtyBefore : new Date(new Date(`${today}T00:00:00Z`).getTime() + 14 * 86_400_000).toISOString().slice(0, 10);

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href={`/tenants/${id}`} className="font-semibold text-accent hover:underline">
          ← {tenant}
        </Link>
      </p>
      <PageHeader
        title="Renewal offer"
        subtitle={`${tenant} · ${lease.unit.property?.name ?? ""}${lease.unit.label !== "Home" ? ` ${lease.unit.label}` : ""} · ${money(lease.rent_cents)} a month · ${lease.end_date ? `ends ${date(lease.end_date)}` : "month-to-month"}`}
      />
      <div className="grid max-w-5xl gap-6">
        {latest && latest.status !== "withdrawn" && (
          <Card>
            <CardHeader title="Latest offer" description={`Sent ${date(latest.sent_at.slice(0, 10))} to ${latest.sent_to.join(", ")} · ${Number(latest.increase_percent)}% increase · answer by ${date(latest.respond_by)}`} action={<Pill tone={STATUS[latest.status]?.tone ?? "neutral"}>{STATUS[latest.status]?.label ?? latest.status}</Pill>} />
            <ol className="divide-y divide-line">
              {(latest.options as unknown[]).map((raw, i) => {
                const c = choiceSchema.safeParse(raw);
                return (
                  <li key={i} className={`flex items-start gap-3 px-5 py-3 text-[14px] ${latest.chosen_option === i ? "bg-accent-softer" : ""}`}>
                    <span className="font-semibold">{i + 1}.</span>
                    <span className="flex-1">{c.success ? describeChoice(c.data, money, date) : "Option"}</span>
                    {latest.chosen_option === i && <Pill tone="success">Chosen</Pill>}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
              {latest.status === "accepted" && (
                <form action={applyRenewalChoice.bind(null, latest.id)}>
                  <button type="submit" className={buttonClass("primary", true)}>
                    Apply their choice to the lease
                  </button>
                </form>
              )}
              {latest.status === "sent" && (
                <form action={withdrawRenewalOffer.bind(null, latest.id)}>
                  <button type="submit" className={buttonClass("secondary", true)}>
                    Withdraw this offer
                  </button>
                </form>
              )}
              {latest.status === "accepted" && <p className="self-center text-[13px] text-muted">Applying sets the new rent from the start date{(latest.options as { kind?: string }[])[latest.chosen_option ?? 0]?.kind === "mtm" ? " and adds a to-do for the notice that ends month-to-month" : ", the new end date, and a to-do to send the renewal lease for signature"}.</p>}
            </div>
          </Card>
        )}

        {lease.status !== "active" ? (
          <Notice tone="warn">This lease isn&apos;t active, so it can&apos;t be offered a renewal.</Notice>
        ) : (
          <Card>
            <CardHeader title={latest?.status === "sent" ? "Send a new offer instead" : "New offer"} description="Lengths are marked by how they fit the expiration calendar (best, open, slow or full month)." />
            <div className="px-5 py-4">
              <RenewalOfferForm leaseId={id} currentRentCents={lease.rent_cents} start={start} plan={plan} rules={rules} defaultPicks={[first, second, "mtm"]} defaultRespondBy={respondBy} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
