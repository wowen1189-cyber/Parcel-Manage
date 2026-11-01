"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { startPayment, type PayState } from "./actions";

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
