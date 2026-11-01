import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { date, money } from "@/lib/format";
import { APPLICATION_STATUS, unitName } from "@/lib/leasing";
import { DECISION_LABEL, depositFor, type Recommendation } from "@/lib/screening";
import { requireCompany } from "@/lib/session";
import { setApplicationStatus } from "../../actions";
import { AddMemberForm, DecisionForm, ResendInvite, ScreeningForm } from "../../forms";

export const metadata = { title: "Application" };

const ROLE: Record<string, string> = { applicant: "Applicant", co_applicant: "Co-applicant", guarantor: "Guarantor" };

/** Answers are stored as flat key → value; show them with readable labels. */
function Answers({ answers }: { answers: unknown }) {
  const rows = Object.entries((answers ?? {}) as Record<string, unknown>).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  if (!rows.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[12px] font-semibold text-subtle">{k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}</dt>
          <dd>{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ApplicationPage({ params }: PageProps<"/leasing/applications/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: a } = await supabase
    .from("application")
    .select(
      "id, status, kind, rent_cents, desired_move_in, answers, fees_due_cents, fees_paid_cents, admin_fee_refunded_cents, recommendation, decision, deposit_cents, decision_note, decided_at, adverse_action_sent_at, adverse_agency, submitted_at, created_at, unit(id, label, property(name)), application_member(id, role, first_name, last_name, email, phone, monthly_income_cents, answers, status, invited_at, opened_at, applied_at, screening_report(credit_score, eviction_years_ago, owes_landlord, utility_or_car_problems, criminal_records, agency_name, report_ref, received_at))",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!a) notFound();
  const rules = readBusinessRules(company.settings);
  const rec = a.recommendation as (Recommendation & { screened: number; adults: number }) | null;
  const members = [...a.application_member].sort((x, y) => (x.role === "applicant" ? -1 : y.role === "applicant" ? 1 : x.invited_at.localeCompare(y.invited_at)));
  const adults = members.filter((m) => m.role !== "guarantor");
  const income = adults.reduce((s, m) => s + m.monthly_income_cents, 0);
  const canEdit = ["admin", "property_manager", "leasing_agent"].includes(membership.role);
  const decidable = ["new", "screening"].includes(a.status);
  const st = APPLICATION_STATUS[a.status];
  const agency = members.find((m) => m.screening_report?.agency_name)?.screening_report?.agency_name ?? "";
  return (
    <>
      <PageHeader
        title={adults.map((m) => `${m.first_name} ${m.last_name}`.trim()).join(" & ") || "Application"}
        subtitle={`${unitName(a.unit)} · ${a.kind === "commercial" ? "Commercial" : "Residential"} · ${money(a.rent_cents)}/month`}
        action={
          <Link href="/leasing?tab=applicants" className="text-[14px] font-semibold text-accent">
            ← Applicants
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Pill tone={st.tone}>{st.label}</Pill>
        <span className="text-[14px] text-muted">
          {a.submitted_at ? `Submitted ${date(a.submitted_at)}` : "Not submitted yet"} · Fees {money(a.fees_paid_cents)} paid of {money(a.fees_due_cents)}
          {a.admin_fee_refunded_cents ? ` · ${money(a.admin_fee_refunded_cents)} admin fee refunded` : ""}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {members.map((m) => (
            <Card key={m.id}>
              <CardHeader
                title={`${m.first_name} ${m.last_name}`.trim()}
                description={`${ROLE[m.role]} · ${m.status === "applied" ? `Applied ${date(m.applied_at)}` : m.opened_at ? "Opened the link, not finished" : "Invited, hasn't opened the link"}${m.monthly_income_cents ? ` · ${money(m.monthly_income_cents)}/month income` : ""}`}
                action={m.status === "applied" ? <Pill tone="success">Applied</Pill> : <Pill>Waiting</Pill>}
              />
              <div className="space-y-4 px-5 py-4">
                <p className="text-[14px] text-muted">{[m.email, m.phone].filter(Boolean).join(" · ")}</p>
                <Answers answers={m.answers} />
                {m.status === "invited" && canEdit && <ResendInvite memberId={m.id} />}
                {m.status === "applied" && canEdit && (
                  <details className="rounded-[var(--radius-control)] border border-line p-3" open={!m.screening_report && a.status !== "declined"}>
                    <summary className="cursor-pointer text-[14px] font-semibold">{m.screening_report ? `Screening results (entered ${date(m.screening_report.received_at)})` : "Enter screening results"}</summary>
                    <div className="mt-3">
                      <ScreeningForm memberId={m.id} report={m.screening_report ? { ...m.screening_report, eviction_years_ago: m.screening_report.eviction_years_ago === null ? null : Number(m.screening_report.eviction_years_ago) } : null} />
                    </div>
                  </details>
                )}
              </div>
            </Card>
          ))}
          {a.answers && Object.keys(a.answers as object).length > 0 && (
            <Card>
              <CardHeader title="Household" />
              <div className="px-5 py-4">
                <Answers answers={a.answers} />
              </div>
            </Card>
          )}
          {canEdit && !["declined", "signed", "withdrawn"].includes(a.status) && (
            <Card>
              <CardHeader title="Add a co-applicant or guarantor" description="Every adult who will live there applies. They're linked to this household automatically." />
              <div className="px-5 py-4">
                <AddMemberForm applicationId={a.id} />
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Against your criteria" description="The same rules for every applicant (Settings › Business rules)." />
            <div className="space-y-3 px-5 py-4 text-[14px]">
              <p>
                Household income {money(income)}/month: <strong>{a.rent_cents ? (income / a.rent_cents).toFixed(2) : "0"}×</strong> rent (minimum {rules.screening.incomeMultiple}×).
              </p>
              {rec ? (
                <>
                  <p>
                    Suggested: <strong>{DECISION_LABEL[rec.decision]}</strong>
                    {rec.screened < rec.adults ? ` (screening entered for ${rec.screened} of ${rec.adults} adults)` : ""}
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {rec.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {rec.decision !== "decline" && (
                    <p>
                      Deposit: {rec.depositMonths.min === rec.depositMonths.max ? `${rec.depositMonths.min} month` : `${rec.depositMonths.min}–${rec.depositMonths.max} months`} ({money(depositFor(a.rent_cents, rec.depositMonths.min))}
                      {rec.depositMonths.max !== rec.depositMonths.min ? `–${money(depositFor(a.rent_cents, rec.depositMonths.max))}` : ""}).
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted">Enter screening results to see the suggestion.</p>
              )}
              <p className="text-[12px] text-subtle">A suggestion only. A person makes every decision.</p>
            </div>
          </Card>

          {a.decision && (
            <Card>
              <CardHeader title="Decision" />
              <div className="space-y-2 px-5 py-4 text-[14px]">
                <p>
                  <strong>{DECISION_LABEL[a.decision as keyof typeof DECISION_LABEL]}</strong> on {date(a.decided_at)}
                  {a.deposit_cents ? ` · deposit ${money(a.deposit_cents)}` : ""}
                </p>
                {a.adverse_action_sent_at && <p>Adverse action notice e-mailed {date(a.adverse_action_sent_at)}.</p>}
                {a.adverse_agency && !a.adverse_action_sent_at && <Notice tone="warn">The adverse action notice wasn&apos;t e-mailed. Print it and mail it to each applicant (FCRA).</Notice>}
                {a.adverse_agency && (
                  <Link href={`/leasing/applications/${a.id}/notice`} className="font-semibold text-accent underline">
                    Print the adverse action notice
                  </Link>
                )}
                {a.decision_note && <p className="text-muted">{a.decision_note}</p>}
              </div>
            </Card>
          )}

          {canEdit && decidable && (
            <Card>
              <CardHeader title="Decide" />
              <div className="px-5 py-4">
                {adults.some((m) => m.status !== "applied") && <Notice tone="warn">Not every adult has applied yet.</Notice>}
                <DecisionForm
                  key={rec?.decision ?? "none"}
                  applicationId={a.id}
                  suggested={rec?.decision ?? "approve"}
                  agency={agency}
                  depositDefaults={{
                    approve: (depositFor(a.rent_cents, rules.screening.depositMonthsAtOrAboveTier) / 100).toFixed(2),
                    approve_higher_deposit: (depositFor(a.rent_cents, rules.screening.depositMonthsBelowTierMin) / 100).toFixed(2),
                  }}
                />
              </div>
            </Card>
          )}

          {canEdit && a.status === "approved" && (
            <Card>
              <CardHeader title="Next: the lease" description="Create the tenant and lease, then send it for e-signature." />
              <div className="flex flex-wrap gap-3 px-5 py-4">
                <Link href={`/tenants/new?unit=${a.unit.id}&application=${a.id}`} className="min-h-11 rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-[14px] font-semibold text-white">
                  Create tenant and lease
                </Link>
                <form action={setApplicationStatus}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="lease_sent" />
                  <button className="min-h-11 text-[14px] font-semibold text-accent">Mark lease sent</button>
                </form>
              </div>
            </Card>
          )}
          {canEdit && a.status === "lease_sent" && (
            <form action={setApplicationStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="signed" />
              <button className="min-h-11 text-[14px] font-semibold text-accent">Mark lease signed</button>
            </form>
          )}
          {canEdit && !["declined", "signed", "withdrawn"].includes(a.status) && (
            <form action={setApplicationStatus}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="withdrawn" />
              <button className="min-h-11 text-[13px] font-semibold text-danger">Applicant withdrew</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
