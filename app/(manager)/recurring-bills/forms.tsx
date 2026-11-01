"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { createDueNow, createRecurringBill, type RecurringState } from "./actions";

const empty: RecurringState = {};

export function NewRecurringForm({ vendors, properties, accounts, today }: { vendors: { id: string; name: string }[]; properties: { id: string; name: string }[]; accounts: [string, string][]; today: string }) {
  const [state, action, pending] = useActionState(createRecurringBill, empty);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Vendor">
          <Select name="vendor_id" defaultValue="">
            <option value="">Choose…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property">
          <Select name="property_id" defaultValue="">
            <option value="">Choose…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount ($)">
          <Input name="amount" inputMode="decimal" />
        </Field>
        <Field label="What for">
          <Input name="memo" placeholder="Monthly lawn care" />
        </Field>
        <Field label="Expense account">
          <Select name="expense_account" defaultValue="5000">
            {accounts.map(([n, l]) => (
              <option key={n} value={n}>
                {n} {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How often">
          <Select name="frequency" defaultValue="monthly">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Every 3 months</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field label="First bill date">
          <Input type="date" name="next_on" defaultValue={today} />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Add recurring bill"}
      </Button>
    </form>
  );
}

export function DueNowButton() {
  const [state, action, pending] = useActionState(createDueNow, empty);
  return (
    <form action={action} className="flex items-center gap-3">
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Creating…" : "Create due bills now"}
      </Button>
      {state.message && <span className="text-[13px] text-accent">{state.message}</span>}
      {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
    </form>
  );
}
