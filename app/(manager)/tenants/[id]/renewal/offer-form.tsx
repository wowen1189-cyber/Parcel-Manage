"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { BusinessRules } from "@/lib/business-rules";
import type { TermOption } from "@/lib/lease-expirations";
import { MAX_OPTIONS, mtmChoice, termChoice } from "@/lib/renewal-offers";
import { sendRenewalOffer, type OfferState } from "./actions";

const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const FIT: Record<string, string> = { good: "open month", avoid: "slow month", full: "full month" };

// Build the offer: the increase (company default, any figure can be typed), and up to three options, one of
// which may be month-to-month. Prices update as you change them; the server prices them again when sent.
export function RenewalOfferForm(props: { leaseId: string; currentRentCents: number; start: string; plan: TermOption[]; rules: BusinessRules; defaultPicks: string[]; defaultRespondBy: string }) {
  const [state, action, pending] = useActionState(sendRenewalOffer.bind(null, props.leaseId), {} as OfferState);
  const [increase, setIncrease] = useState(String(props.rules.renewal.defaultIncreasePercent));
  const [picks, setPicks] = useState<string[]>(props.defaultPicks);
  const pct = Number(increase);
  const valid = increase.trim() !== "" && Number.isFinite(pct) && pct >= 0 && pct <= 25;

  const priced = picks.map((p) => {
    if (!p || !valid) return null;
    if (p === "mtm") return mtmChoice({ currentRentCents: props.currentRentCents, increasePercent: pct, start: props.start, rules: props.rules });
    const o = props.plan.find((x) => x.months === Number(p));
    return o ? termChoice({ currentRentCents: props.currentRentCents, increasePercent: pct, start: props.start, months: o.months, endDate: o.endDate, rules: props.rules }) : null;
  });

  return (
    <form action={action} className="space-y-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label="Rent increase (%)" hint={`Company default ${props.rules.renewal.defaultIncreasePercent}%. Type any figure.`}>
          <Input name="increase" inputMode="decimal" value={increase} onChange={(e) => setIncrease(e.target.value)} />
        </Field>
        <div className="self-end pb-1 text-[14px] text-muted">
          Current rent {fmt(props.currentRentCents)} → <strong className="text-ink">{valid ? fmt(Math.round((props.currentRentCents * (100 + pct)) / 100)) : "—"}</strong> before any surcharge or fee. Starts {day(props.start)}.
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-ink-2">Options to offer (up to {MAX_OPTIONS})</p>
        {Array.from({ length: MAX_OPTIONS }, (_, i) => {
          const c = priced[i];
          return (
            <div key={i} className="grid gap-3 rounded-[var(--radius-control)] border border-line px-4 py-3 sm:grid-cols-[260px_1fr] sm:items-center">
              <Select
                name={`option${i + 1}`}
                aria-label={`Option ${i + 1}`}
                value={picks[i] ?? ""}
                onChange={(e) => setPicks((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
              >
                <option value="">{i === 0 ? "Choose a length" : "No option"}</option>
                {props.plan.map((o) => (
                  <option key={o.months} value={o.months}>
                    {o.months} months · to {day(o.endDate)}
                    {o.recommended ? " · best" : ` · ${FIT[o.status] ?? ""}`}
                  </option>
                ))}
                <option value="mtm">Month-to-month (up to {props.rules.renewal.mtmMaxMonths} months)</option>
              </Select>
              <div className="text-[14px]">
                {c ? (
                  c.kind === "mtm" ? (
                    <>
                      <span className="font-semibold">{fmt(c.rentCents)} a month</span>
                      <span className="text-muted"> incl. {fmt(c.feeCents)} month-to-month fee · through {day(c.lastDay)} at most</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{fmt(c.rentCents)} a month</span>
                      <span className="text-muted">
                        {" "}
                        · {day(c.start)} to {day(c.endDate)}
                        {c.surchargeCents ? ` · incl. ${fmt(c.surchargeCents)} short-term` : ""}
                        {c.yearlyIncreasePercent ? ` · +${c.yearlyIncreasePercent}% after 12 months` : ""}
                      </span>
                    </>
                  )
                ) : (
                  <span className="text-subtle">{picks[i] ? "Enter the increase" : "Not offered"}</span>
                )}
              </div>
            </div>
          );
        })}
        {picks.filter((p) => p === "mtm").length > 1 && <Notice tone="warn">Offer month-to-month only once.</Notice>}
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <Field label="Answer by">
          <Input type="date" name="respond_by" defaultValue={props.defaultRespondBy} />
        </Field>
        <Field label="Note to the tenant (optional)">
          <Textarea name="message" className="min-h-16" placeholder="Thanks for being a great resident." />
        </Field>
      </div>
      <p className="text-[13px] text-subtle">
        The tenant gets an e-mail with these options and chooses one in their resident portal. Nothing changes on the lease until you apply their choice.
      </p>
      <Button type="submit" disabled={pending || !valid}>
        {pending ? "Sending…" : "Send renewal offer"}
      </Button>
    </form>
  );
}
