"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { CHARGE_TYPES, PAYMENT_METHODS } from "@/lib/ledger";
import { addCharge, recordPayment, returnPayment, type LedgerState } from "../ledger-actions";

const empty: LedgerState = {};

function Status({ state }: { state: LedgerState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** Record a check, money order, cash or other payment, for rent or the security deposit. */
export function PaymentForm({ leaseId, today, certifiedOnly }: { leaseId: string; today: string; certifiedOnly: boolean }) {
  const [state, action, pending] = useActionState(recordPayment, empty);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  const [method, setMethod] = useState(v("method", certifiedOnly ? "money_order" : "check"));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lease_id" value={leaseId} />
      <Status state={state} />
      {certifiedOnly && (method === "check" || method === "ach") && <Notice tone="warn">This tenant must pay by money order or cashier&apos;s check (after a returned payment).</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="For">
          <Select name="purpose" defaultValue={v("purpose", "rent")}>
            <option value="rent">Rent and charges</option>
            <option value="deposit">Security deposit (held in trust)</option>
          </Select>
        </Field>
        <Field label="Paid by">
          <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" defaultValue={v("amount", "")} />
        </Field>
        <Field label="Received">
          <Input type="date" name="received_on" defaultValue={v("received_on", today)} max={today} />
        </Field>
        <Field label="Check or reference number" hint="Optional">
          <Input name="reference" defaultValue={v("reference", "")} />
        </Field>
        <Field label="Note" hint="Optional">
          <Input name="memo" defaultValue={v("memo", "")} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" name="send_receipt" defaultChecked className="size-4" />
        E-mail a receipt to the tenant
      </label>
      <Button type="submit" small disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}

/** Post a one-time charge (damage, utility, pet fee…). Rent and late fees post automatically. */
export function ChargeForm({ leaseId, today }: { leaseId: string; today: string }) {
  const [state, action, pending] = useActionState(addCharge, empty);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lease_id" value={leaseId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select name="charge_type" defaultValue={v("charge_type", "other")}>
            {Object.entries(CHARGE_TYPES)
              .filter(([k]) => k !== "opening_balance")
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input name="description" defaultValue={v("description", "")} placeholder="Replace broken blinds" />
        </Field>
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" defaultValue={v("amount", "")} />
        </Field>
        <Field label="Due">
          <Input type="date" name="due_date" defaultValue={v("due_date", today)} />
        </Field>
      </div>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Posting…" : "Post charge"}
      </Button>
    </form>
  );
}

/** Mark a payment returned (bounced check or returned ACH). */
export function ReturnPaymentButton({ paymentId, today, fee }: { paymentId: string; today: string; fee: string | null }) {
  const [state, action, pending] = useActionState(returnPayment, empty);
  const [open, setOpen] = useState(false);
  if (state.message) return <span className="text-[12px] text-subtle">{state.message}</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-semibold text-accent hover:underline">
        Returned?
      </button>
    );
  return (
    <form action={action} className="mt-2 space-y-2 text-left">
      <input type="hidden" name="payment_id" value={paymentId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Input type="date" name="returned_on" defaultValue={today} max={today} aria-label="Date returned" />
      {fee && (
        <label className="flex items-center gap-2 text-[12px]">
          <input type="checkbox" name="charge_fee" defaultChecked className="size-4 accent-[var(--color-accent)]" />
          Charge the {fee} returned-payment fee
        </label>
      )}
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark returned"}
      </Button>
    </form>
  );
}
