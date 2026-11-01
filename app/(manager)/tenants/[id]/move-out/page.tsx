import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClass, Card, CardHeader, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { claimDeadlines, daysUntil, depositDeadlines, depositHeldCents, settlement } from "@/lib/deposits";
import { contactName, date, money, todayIn } from "@/lib/format";
import { buildLedger } from "@/lib/ledger";
import { requireCompany } from "@/lib/session";
import { recordObjection } from "./actions";
import { ClaimButton, DeductionsForm, NoticeSentForm, SettleForm, StartForm } from "./forms";

export const metadata = { title: "Move-out" };

function Deadline({ label, due, today, done }: { label: string; due: string; today: string; done?: boolean }) {
  const left = daysUntil(today, due);
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <span>
        {date(due)} {done ? <Pill tone="success">Done</Pill> : left < 0 ? <Pill tone="danger">Passed {-left} days ago</Pill> : <Pill tone={left <= 5 ? "warn" : "neutral"}>{left} days left</Pill>}
      </span>
    </p>
  );
}

export default async function MoveOutPage({ params }: PageProps<"/tenants/[id]/move-out">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select("id, status, move_out_on, end_date, email_notices_agreed, opening_balance_cents, opening_balance_as_of, unit(label, kind, property(name)), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name)), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at), move_out(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();
  const today = todayIn(company.time_zone);
  const mo = l.move_out;
  const name = contactName([...l.lease_tenant].filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.contact);
  const held = depositHeldCents(l.payment, mo?.closed_at ? mo.refund_cents : 0);
  const balance = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of }).balanceCents;
  const canEdit = ["admin", "property_manager", "accountant"].includes(membership.role);
  const commercial = l.unit.kind === "commercial";
  const { data: notices } = mo ? await supabase.from("message").select("id, subject, created_at, delivery").eq("lease_id", l.id).eq("template_id", "deposit-claim").order("created_at", { ascending: false }) : { data: [] };
  const deductions = (mo?.deductions ?? []) as { description: string; amount_cents: number }[];
  const deductionTotal = deductions.reduce((s, d) => s + d.amount_cents, 0);
  const dl = mo ? depositDeadlines(mo.vacated_on) : null;
  const cl = mo?.claim_notice_sent_on && mo.claim_notice_method ? claimDeadlines(mo.claim_notice_sent_on, mo.claim_notice_method as "certified_mail" | "email_addendum") : null;
  const claimEstimate = settlement(held, Math.max(0, balance + (mo?.decision ? 0 : deductionTotal)), true);
  const reason = deductions.map((d) => `${d.description} (${money(d.amount_cents)})`).join("; ");
  const letterHref = `/communications/new?template=deposit-claim&lease=${l.id}&in_amount=${(claimEstimate.applyCents / 100).toFixed(2)}&in_reason=${encodeURIComponent(reason + (balance > 0 && !mo?.decision ? `; unpaid balance ${money(balance)}` : ""))}`;

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href={`/tenants/${l.id}`} className="font-semibold text-accent hover:underline">
          ← {name}
        </Link>
      </p>
      <PageHeader title="Move-out and deposit" subtitle={`${name} · ${l.unit.property.name}${l.unit.label !== "Home" ? ` ${l.unit.label}` : ""}`} action={mo?.closed_at ? <Pill tone="success">Settled</Pill> : mo ? <Pill tone="warn">Open</Pill> : undefined} />
      {commercial && <Notice>Commercial lease: the deposit follows the lease (Section 4.4: returned within 60 days with a list of deductions). The Florida residential deadlines below are shown for reference only.</Notice>}

      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Deposit held in trust" value={money(held)} />
        <StatTile label={balance < 0 ? "Credit" : "Balance owed"} value={money(Math.abs(balance))} note="On the ledger now" />
        <StatTile label="Deductions listed" value={money(deductionTotal)} note={`${deductions.length} items`} />
      </div>

      {!mo ? (
        <Card>
          <CardHeader title="Record the move-out" description="Do this once the tenant has moved out and returned the keys. It ends the lease, frees the unit and starts the deposit deadlines." />
          <div className="px-5 py-4">{canEdit ? <StartForm leaseId={l.id} today={today} defaultDate={l.move_out_on && l.move_out_on <= today ? l.move_out_on : today} /> : <p className="text-sm">Ask an admin or property manager.</p>}</div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Inspection and deductions" description="Damage beyond normal wear and tear, cleaning, and other charges the lease allows." />
              <div className="px-5 py-4">
                <DeductionsForm moveOutId={mo.id} deductions={deductions} notes={mo.inspection_notes ?? ""} locked={!canEdit || Boolean(mo.decision)} />
              </div>
            </Card>

            {!mo.closed_at && canEdit && (
              <Card>
                <CardHeader title="The deposit" description="Return it in full, or claim against it with a timely notice." />
                <div className="space-y-5 px-5 py-4">
                  {!mo.decision && (
                    <>
                      <div className="rounded-[var(--radius-control)] border border-line p-4">
                        <p className="font-semibold">Return the full deposit</p>
                        <p className="mb-3 text-[13px] text-subtle">Within 15 days of move-out. Any balance owed stays on the ledger to collect separately.</p>
                        <SettleForm moveOutId={mo.id} decision="return_full" today={today} summary={`Refund ${money(held)} from trust.`} />
                      </div>
                      <div className="rounded-[var(--radius-control)] border border-line p-4">
                        <p className="font-semibold">Claim against the deposit</p>
                        <p className="mb-3 text-[13px] text-subtle">Posts the deductions to the ledger. Then send the claim notice by certified mail within 30 days of move-out.</p>
                        <ClaimButton moveOutId={mo.id} disabled={!deductions.length && balance <= 0} />
                      </div>
                    </>
                  )}
                  {mo.decision === "claim" && !mo.claim_notice_sent_on && (
                    <div className="space-y-3">
                      <Link href={letterHref} className={buttonClass("primary", true)}>
                        Write the claim notice
                      </Link>
                      <p className="text-[13px] text-subtle">Uses the statutory form, prefilled with {money(claimEstimate.applyCents)} and the reasons. Print it and send by certified mail (or e-mail if the tenant signed the 83.505 addendum), then record it here.</p>
                      <NoticeSentForm moveOutId={mo.id} today={today} messages={(notices ?? []).map((n) => ({ id: n.id, label: `${date(n.created_at.slice(0, 10))} · ${n.delivery}` }))} />
                    </div>
                  )}
                  {mo.decision === "claim" && mo.claim_notice_sent_on && (
                    <div className="space-y-4">
                      {mo.objection_received_on ? (
                        <Notice tone="warn">The tenant objected on {date(mo.objection_received_on)}. Work it out with them (or the court decides); then settle with the agreed amounts.</Notice>
                      ) : (
                        <form action={recordObjection} className="flex flex-wrap items-end gap-2 text-sm">
                          <input type="hidden" name="move_out_id" value={mo.id} />
                          <span>Tenant objected in writing?</span>
                          <input type="date" name="received_on" defaultValue={today} className="min-h-10 rounded-[var(--radius-control)] border border-line-strong px-2" aria-label="Objection received" />
                          <Button type="submit" small variant="ghost">
                            Record objection
                          </Button>
                        </form>
                      )}
                      <SettleForm moveOutId={mo.id} decision="claim" today={today} summary={`Apply ${money(settlement(held, Math.max(0, balance), true).applyCents)} to the balance and refund ${money(settlement(held, Math.max(0, balance), true).refundCents)}.`} />
                    </div>
                  )}
                </div>
              </Card>
            )}
            {mo.closed_at && (
              <Notice tone="success">
                Settled {date(mo.closed_at.slice(0, 10))}: {mo.decision === "claim" ? "claim applied" : "returned in full"}, refund {money(mo.refund_cents ?? 0)}
                {mo.refund_reference ? ` (${mo.refund_reference})` : ""}.
              </Notice>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Florida deadlines" description="Fla. Stat. 83.49(3), from the move-out date." />
              <div className="space-y-3 px-5 py-4">
                <p className="text-sm">Moved out {date(mo.vacated_on)}{mo.forwarding_address ? ` · forwarding: ${mo.forwarding_address}` : ""}</p>
                {dl && <Deadline label="Return the full deposit by" due={dl.returnBy} today={today} done={Boolean(mo.closed_at) || mo.decision === "claim"} />}
                {dl && <Deadline label="Or send the claim notice by" due={dl.claimNoticeBy} today={today} done={Boolean(mo.claim_notice_sent_on) || mo.decision === "return_full"} />}
                {cl && <Deadline label="Tenant's objection window ends about" due={cl.objectionEnds} today={today} done={Boolean(mo.closed_at)} />}
                {cl && <Deadline label="Pay the remaining deposit by" due={cl.balanceDueBy} today={today} done={Boolean(mo.closed_at)} />}
                <p className="text-[12px] text-subtle">Miss the 30-day notice and the right to claim against the deposit is lost; you can still sue for damages after returning it.</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
