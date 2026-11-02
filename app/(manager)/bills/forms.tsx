"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { approveBill, createBill, payBill, type BillState } from "./actions";

const empty: BillState = {};
function Status({ state }: { state: BillState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function NewBillForm({ vendors, properties, accounts, today, purchaseOrders = [] }: { vendors: { id: string; name: string }[]; properties: { id: string; name: string }[]; accounts: [string, string][]; today: string; purchaseOrders?: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createBill, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  return (
    <form action={action} className="space-y-4 p-5">
      <Status state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor">
          <Select name="vendor_id" defaultValue={v("vendor_id")}>
            <option value="">Choose…</option>
            {vendors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property" hint="Posts to that property's owner">
          <Select name="property_id" defaultValue={v("property_id")}>
            <option value="">Choose…</option>
            {properties.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" defaultValue={v("amount")} />
        </Field>
        <Field label="Expense account">
          <Select name="expense_account" defaultValue={v("expense_account", "5000")}>
            {accounts.map(([n, label]) => (
              <option key={n} value={n}>
                {n} {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice number">
          <Input name="invoice_number" defaultValue={v("invoice_number")} />
        </Field>
        <Field label="Invoice date">
          <Input type="date" name="invoice_date" defaultValue={v("invoice_date", today)} />
        </Field>
        <Field label="Due">
          <Input type="date" name="due_date" defaultValue={v("due_date", today)} />
        </Field>
        <Field label="Memo">
          <Input name="memo" defaultValue={v("memo")} />
        </Field>
        {purchaseOrders.length > 0 && (
          <Field label="Purchase order (optional)" hint="Counts this bill toward that project">
            <Select name="purchase_order_id" defaultValue={v("purchase_order_id")}>
              <option value="">None</option>
              {purchaseOrders.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save bill"}
      </Button>
    </form>
  );
}

export function ApproveForm({ id, amount, account, due, accounts }: { id: string; amount: string; account: string; due: string; accounts: [string, string][] }) {
  const [state, action, pending] = useActionState(approveBill, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" defaultValue={amount} />
        </Field>
        <Field label="Expense account">
          <Select name="expense_account" defaultValue={account}>
            {accounts.map(([n, label]) => (
              <option key={n} value={n}>
                {n} {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due">
          <Input type="date" name="due_date" defaultValue={due} />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Approving…" : "Approve bill"}
      </Button>
    </form>
  );
}

export function PayForm({ id, today, blocked }: { id: string; today: string; blocked: string | null }) {
  const [state, action, pending] = useActionState(payBill, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Status state={state} />
      {blocked && <Notice tone="warn">{blocked}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Paid on">
          <Input type="date" name="paid_on" defaultValue={today} />
        </Field>
        <Field label="How">
          <Select name="payment_method" defaultValue="check">
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Check or reference #">
          <Input name="payment_reference" />
        </Field>
      </div>
      <Button type="submit" small disabled={pending || Boolean(blocked)}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}
