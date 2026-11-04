"use client";

import { useActionState } from "react";
import { AccountSelect } from "@/components/account-select";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { AccountOption } from "@/lib/accounts";
import type { WorkOrderPick } from "@/lib/bills";
import { approveBill, createBill, editBill, payBill, type BillState } from "./actions";
import { WorkOrderPicker } from "./work-order-picker";

const empty: BillState = {};
// After a failed save, keep the work order that was chosen (it may be one found by search).
const typedWorkOrder = (values: Record<string, string> | undefined, recent: WorkOrderPick[]): WorkOrderPick | null => {
  const n = Number((values?.work_order ?? "").replace("#", ""));
  return n ? (recent.find((w) => w.number === n) ?? { number: n, title: values?.work_order_label ?? "", property: values?.work_order_property ?? "" }) : null;
};
function Status({ state }: { state: BillState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function NewBillForm({ vendors, properties, accounts, today, recentWorkOrders, purchaseOrders = [] }: { vendors: { id: string; name: string }[]; properties: { id: string; name: string }[]; accounts: AccountOption[]; today: string; recentWorkOrders: WorkOrderPick[]; purchaseOrders?: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createBill, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="space-y-4 p-5">
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
          <AccountSelect accounts={accounts} defaultValue={v("expense_account", "5000")} />
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
        <WorkOrderPicker key={v("work_order")} recent={recentWorkOrders} current={typedWorkOrder(state.values, recentWorkOrders)} />
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

export function ApproveForm({ id, amount, account, due, accounts }: { id: string; amount: string; account: string; due: string; accounts: AccountOption[] }) {
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
          <AccountSelect accounts={accounts} defaultValue={account} />
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

export function EditBillForm({ bill, vendors, properties, recentWorkOrders }: { bill: { id: string; vendor_id: string | null; property_id: string | null; work_order: WorkOrderPick | null; invoice_number: string; invoice_date: string; memo: string }; vendors: { id: string; name: string }[]; properties: { id: string; name: string }[]; recentWorkOrders: WorkOrderPick[] }) {
  const [state, action, pending] = useActionState(editBill, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={bill.id} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor">
          <Select name="vendor_id" defaultValue={bill.vendor_id ?? ""}>
            <option value="">Choose…</option>
            {vendors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property" hint="Posts to that property's owner">
          <Select name="property_id" defaultValue={bill.property_id ?? ""}>
            <option value="">Choose…</option>
            {properties.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <WorkOrderPicker recent={recentWorkOrders} current={bill.work_order} />
        <Field label="Invoice number">
          <Input name="invoice_number" defaultValue={bill.invoice_number} />
        </Field>
        <Field label="Invoice date">
          <Input type="date" name="invoice_date" defaultValue={bill.invoice_date} />
        </Field>
        <Field label="Memo">
          <Input name="memo" defaultValue={bill.memo} />
        </Field>
      </div>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
