"use client";

import { useActionState, useMemo, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { createBankAccount, importStatement, reconcile, type BankState } from "./actions";

const empty: BankState = {};
function Status({ state }: { state: BankState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function NewAccountForm({ owners }: { owners: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createBankAccount, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Owner">
          <Select name="entity_id">
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account name">
          <Input name="name" placeholder="Operating" />
        </Field>
        <Field label="Bank">
          <Input name="institution" placeholder="United Southern Bank" />
        </Field>
        <Field label="Last 4">
          <Input name="last4" inputMode="numeric" maxLength={4} />
        </Field>
        <Field label="Kind">
          <Select name="gl_number" defaultValue="1000">
            <option value="1000">Operating</option>
            <option value="1010">Security deposit trust</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </Button>
    </form>
  );
}

export function ImportForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(importStatement, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <Status state={state} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Statement or transactions CSV" hint="From your bank's website: Download → CSV">
          <Input type="file" name="file" accept=".csv,text/csv" className="py-2.5" />
        </Field>
        <Button type="submit" small disabled={pending}>
          {pending ? "Importing…" : "Import and match"}
        </Button>
      </div>
    </form>
  );
}

export function ReconcileForm({ accountId, lines, clearedBefore, today }: { accountId: string; lines: { id: string; date: string; memo: string; amount: number; matched: boolean }[]; clearedBefore: number; today: string }) {
  const [state, action, pending] = useActionState(reconcile, empty);
  const [date, setDate] = useState(today);
  const [balance, setBalance] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set(lines.filter((l) => l.matched).map((l) => l.id)));
  const visible = useMemo(() => lines.filter((l) => l.date <= date), [lines, date]);
  const cleared = clearedBefore + visible.filter((l) => checked.has(l.id)).reduce((s, l) => s + l.amount, 0);
  const statement = Math.round(Number(balance.replace(/[$,\s]/g, "")) * 100);
  const diff = balance ? statement - cleared : null;
  const fmt = (c: number) => `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Statement ending date">
          <Input type="date" name="statement_date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Statement ending balance ($)">
          <Input name="statement_balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-[var(--radius-control)] border border-line">
        {visible.length ? (
          visible.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="line"
                  value={l.id}
                  checked={checked.has(l.id)}
                  onChange={(e) => setChecked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(l.id);
                    else n.delete(l.id);
                    return n;
                  })}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {l.date} · {l.memo}
              </span>
              <span className={l.amount < 0 ? "" : "text-accent"}>{fmt(l.amount)}</span>
            </label>
          ))
        ) : (
          <p className="px-3 py-3 text-[13px] text-subtle">Nothing uncleared up to this date.</p>
        )}
      </div>
      <p className={`text-sm font-semibold ${diff === 0 ? "text-accent" : "text-danger"}`}>
        Cleared {fmt(cleared)}
        {diff != null && ` · difference ${fmt(diff)}`}
      </p>
      <Button type="submit" disabled={pending || diff !== 0}>
        {pending ? "Saving…" : "Finish reconciliation"}
      </Button>
    </form>
  );
}
