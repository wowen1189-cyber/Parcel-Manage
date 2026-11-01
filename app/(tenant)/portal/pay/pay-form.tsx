"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { startAutopay, startPayment, type PayState } from "./actions";

const empty: PayState = {};

export function PayForm({ balanceCents, feePercent }: { balanceCents: number; feePercent: number }) {
  const [state, action, pending] = useActionState(startPayment, empty);
  const [amount, setAmount] = useState(balanceCents > 0 ? (balanceCents / 100).toFixed(2) : "");
  const [method, setMethod] = useState<"ach" | "card">("ach");
  const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100) || 0;
  const fee = method === "card" ? Math.round((cents * feePercent) / 100) : 0;
  const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Amount ($)">
        <Input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-semibold text-ink-2">Pay with</legend>
        {(
          [
            ["ach", "Bank account (free)", "Takes 3–5 business days to clear."],
            ["card", `Debit or credit card (+${feePercent}% fee)`, "Clears right away."],
          ] as const
        ).map(([k, label, hint]) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line-strong px-3 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-softer">
            <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} className="mt-1 size-4 accent-[var(--color-accent)]" />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="text-[13px] text-subtle">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-[15px]">
        <p className="flex justify-between">
          <span>Payment</span>
          <span>{fmt(cents)}</span>
        </p>
        {fee > 0 && (
          <p className="flex justify-between">
            <span>Card convenience fee ({feePercent}%)</span>
            <span>{fmt(fee)}</span>
          </p>
        )}
        <p className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
          <span>Total charged</span>
          <span>{fmt(cents + fee)}</span>
        </p>
      </div>
      <Button type="submit" disabled={pending || cents < 100} className="w-full sm:w-auto">
        {pending ? "Opening secure checkout…" : `Continue to pay ${fmt(cents + fee)}`}
      </Button>
      <p className="text-[12px] text-subtle">Payments are processed securely by Stripe. Your card or bank details never touch our servers.</p>
    </form>
  );
}

export function AutopayForm({ companyName }: { companyName: string }) {
  const [state, action, pending] = useActionState(startAutopay, empty);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Day of the month to pay" hint="1 to 28. Rent is due on the 1st.">
          <Input name="day" type="number" min={1} max={28} defaultValue={1} />
        </Field>
        <Field label="Most to pay at once ($)" hint="Optional. Leave blank to pay the full balance.">
          <Input name="max" inputMode="decimal" />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
        <span>
          I authorize {companyName} to draft my bank account each month on the day above for the balance due on my lease (up to the limit, if I set one), until I turn
          autopay off here. Bank payments are free.
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Opening secure bank link…" : "Set up autopay"}
      </Button>
    </form>
  );
}
