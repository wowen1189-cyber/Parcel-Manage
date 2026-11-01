"use client";

import { useActionState, useMemo, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Pill, Select } from "@/components/ui";
import type { BusinessRules } from "@/lib/business-rules";
import { date, money } from "@/lib/format";
import { countExpirations, recommendTerms, type LeaseEnd } from "@/lib/lease-expirations";
import { createLease, type FormState } from "../actions";

export type UnitOption = { id: string; label: string; propertyId: string; propertyName: string; kind: string; marketRentCents: number | null; status: string; hasActiveLease: boolean };

const empty: FormState = {};
const ROLES: [string, string][] = [
  ["tenant", "Tenant (on the lease)"],
  ["guarantor", "Co-signer (guarantor)"],
  ["occupant", "Occupant (under 18 / not on lease)"],
];

export function NewLeaseForm({
  units,
  leaseEnds,
  unitsByProperty,
  portfolioUnits,
  rules,
  defaultUnitId,
  defaultStart,
}: {
  units: UnitOption[];
  leaseEnds: LeaseEnd[];
  unitsByProperty: Record<string, number>;
  portfolioUnits: number;
  rules: BusinessRules;
  defaultUnitId: string;
  defaultStart: string;
}) {
  const [state, action, pending] = useActionState(createLease, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [unitId, setUnitId] = useState(v("unit_id", defaultUnitId));
  const [start, setStart] = useState(v("start_date", defaultStart));
  const unit = units.find((u) => u.id === unitId);
  const options = useMemo(
    () =>
      unit && /^\d{4}-\d{2}-\d{2}$/.test(start)
        ? recommendTerms({ start, propertyId: unit.propertyId, propertyUnits: unitsByProperty[unit.propertyId] ?? 1, portfolioUnits, counts: countExpirations(leaseEnds), rules })
        : [],
    [unit, start, unitsByProperty, portfolioUnits, leaseEnds, rules],
  );
  const best = options.find((o) => o.recommended);
  const [pickedMonths, setMonths] = useState<number | null>(state.values?.months ? Number(state.values.months) : null);
  const months = pickedMonths ?? best?.months ?? 12;
  const chosen = options.find((o) => o.months === months);
  const [rent, setRent] = useState(v("rent", unit?.marketRentCents ? (unit.marketRentCents / 100).toFixed(2) : ""));
  const rentCents = Math.round(Number(rent.replace(/[$,]/g, "")) * 100) || 0;
  const [people, setPeople] = useState(Math.max(1, ...Array.from({ length: 6 }, (_, i) => (state.values?.[`p${i}_first_name`] ? i + 1 : 0))));
  const byProperty = units.reduce<Record<string, UnitOption[]>>((acc, u) => ((acc[u.propertyName] ??= []).push(u), acc), {});

  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="danger">{state.error}</Notice>}

      <Card>
        <CardHeader title="Unit and dates" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Unit">
            <Select
              name="unit_id"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setMonths(null);
                const u = units.find((x) => x.id === e.target.value);
                if (u?.marketRentCents) setRent((u.marketRentCents / 100).toFixed(2));
              }}
            >
              <option value="">Choose a unit…</option>
              {Object.entries(byProperty).map(([property, list]) => (
                <optgroup key={property} label={property}>
                  {list.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label} · {u.status === "notice" ? "on notice" : u.status}
                      {u.hasActiveLease ? " (has a current lease)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Lease starts">
            <Input
              type="date"
              name="start_date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setMonths(null);
              }}
            />
          </Field>
        </div>
        {unit?.kind === "commercial" && (
          <div className="px-5 pb-4">
            <Notice tone="warn">This is a commercial unit. The residential lease template doesn&apos;t apply; attach your commercial lease to the record.</Notice>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Lease length" description="Ordered by month. The best length keeps move-outs spread out; you can pick any." />
        {options.length ? (
          <>
            <input type="hidden" name="months" value={months} />
            <div className="grid gap-2 p-5 sm:grid-cols-3 lg:grid-cols-4">
              {options.map((o) => (
                <label
                  key={o.months}
                  className={`flex min-h-11 cursor-pointer flex-col rounded-[var(--radius-control)] border px-3 py-2 ${months === o.months ? "border-accent bg-accent-softer" : "border-line-strong hover:bg-surface-sunk"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <input type="radio" checked={months === o.months} onChange={() => setMonths(o.months)} className="size-4 accent-[var(--color-accent)]" />
                      {o.months} months
                    </span>
                    {o.recommended ? <Pill tone="success">Best</Pill> : o.status === "full" ? <Pill tone="danger">Full</Pill> : o.status === "avoid" ? <Pill tone="warn">Slow</Pill> : null}
                  </span>
                  <span className="mt-0.5 pl-6 text-[12px] text-subtle">Ends {date(o.endDate)}</span>
                </label>
              ))}
            </div>
            {chosen && chosen.status !== "good" && (
              <div className="px-5 pb-4">
                <Notice tone="warn">{chosen.reasons.join(". ")}.</Notice>
              </div>
            )}
          </>
        ) : (
          <p className="p-5 text-sm text-subtle">Choose a unit and start date to see lengths.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Rent and deposit" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Monthly rent ($)" hint="Market rent filled in; change as agreed">
            <Input name="rent" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} />
          </Field>
          <Field label="Security deposit ($)" hint={`Default ${rules.screening.depositMonthsAtOrAboveTier} month's rent`}>
            <Input name="deposit" inputMode="decimal" defaultValue={v("deposit", rentCents ? ((rentCents * rules.screening.depositMonthsAtOrAboveTier) / 100).toFixed(2) : "")} key={unitId} />
          </Field>
          <div className="text-sm">
            <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Tenant pays each month</p>
            <p className="text-xl font-bold">{money(rentCents + (chosen?.surchargeCents ?? 0))}</p>
            {chosen && chosen.surchargeCents > 0 && <p className="text-[13px] text-subtle">includes {money(chosen.surchargeCents)} short-term surcharge (under {rules.lease.shortTermUnderMonths} months)</p>}
            {months > 12 && (
              <p className="text-[13px] text-subtle">
                then {money(Math.round(((rentCents + (chosen?.surchargeCents ?? 0)) * (100 + rules.lease.longTermYearlyIncreasePercent)) / 100))} after 12 months (+{rules.lease.longTermYearlyIncreasePercent}%)
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="People" description="Everyone 18 or older who lives there should be a tenant. Co-signers guarantee the rent but don't live there." />
        <div className="space-y-4 p-5">
          {Array.from({ length: people }, (_, i) => (
            <div key={i} className="grid gap-3 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[1.2fr_1fr_1fr_1.3fr_1fr]">
              <Field label={i === 0 ? "Role" : `Person ${i + 1}`}>
                <Select name={`p${i}_role`} defaultValue={v(`p${i}_role`, i === 0 ? "tenant" : "tenant")} disabled={i === 0}>
                  {ROLES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                {i === 0 && <input type="hidden" name="p0_role" value="tenant" />}
              </Field>
              <Field label="First name">
                <Input name={`p${i}_first_name`} defaultValue={v(`p${i}_first_name`)} autoComplete="off" />
              </Field>
              <Field label="Last name">
                <Input name={`p${i}_last_name`} defaultValue={v(`p${i}_last_name`)} autoComplete="off" />
              </Field>
              <Field label="Email">
                <Input name={`p${i}_email`} type="email" defaultValue={v(`p${i}_email`)} autoComplete="off" />
              </Field>
              <Field label="Mobile">
                <Input name={`p${i}_mobile`} type="tel" defaultValue={v(`p${i}_mobile`)} autoComplete="off" />
              </Field>
            </div>
          ))}
          {people < 6 && (
            <button type="button" onClick={() => setPeople(people + 1)} className="text-[13px] font-semibold text-accent hover:underline">
              + Add another person
            </button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Status" />
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          {[
            ["draft", "Draft", "Still being prepared or waiting for signatures. Nothing bills yet."],
            ["active", "Signed and active", "The lease is signed. Rent bills from the start date."],
          ].map(([value, label, hint]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line-strong px-3 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-softer">
              <input type="radio" name="status" value={value} defaultChecked={v("status", "draft") === value} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[13px] text-subtle">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !unit}>
          {pending ? "Saving…" : "Create lease"}
        </Button>
      </div>
    </form>
  );
}
