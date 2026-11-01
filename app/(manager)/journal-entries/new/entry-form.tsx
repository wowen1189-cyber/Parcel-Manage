"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { createJournalEntry, type EntryState } from "../actions";

const empty: EntryState = {};
const toCents = (v: string) => Math.round(Number(v.replace(/[$,\s]/g, "")) * 100) || 0;

export function EntryForm({
  owners,
  accounts,
  properties,
  defaultOwner,
  today,
}: {
  owners: { id: string; name: string }[];
  accounts: { id: string; number: string; name: string }[];
  properties: { id: string; name: string; entity_id: string }[];
  defaultOwner: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(createJournalEntry, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [owner, setOwner] = useState(v("entity_id", defaultOwner));
  const [rows, setRows] = useState(Math.max(2, ...Array.from({ length: 12 }, (_, i) => (state.values?.[`account_${i}`] ? i + 1 : 0))));
  const [amounts, setAmounts] = useState(() => Array.from({ length: 12 }, (_, i) => ({ d: v(`debit_${i}`), c: v(`credit_${i}`) })));
  const debits = amounts.slice(0, rows).reduce((s, a) => s + toCents(a.d), 0);
  const credits = amounts.slice(0, rows).reduce((s, a) => s + toCents(a.c), 0);
  const set = (i: number, k: "d" | "c", val: string) => setAmounts((a) => a.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Card>
        <CardHeader title="Entry" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Owner (whose books)">
            <Select name="entity_id" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" name="entry_date" defaultValue={v("entry_date", today)} />
          </Field>
          <Field label="Memo">
            <Input name="memo" defaultValue={v("memo")} placeholder="Owner contribution for roof repair" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Lines" description="Each line is a debit or a credit. Debits must equal credits to post." />
        <div className="space-y-3 p-5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid gap-3 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[1.6fr_1.2fr_1fr_1fr]">
              <Field label="Account">
                <Select name={`account_${i}`} defaultValue={v(`account_${i}`)}>
                  <option value="">Choose…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Property" hint="Optional">
                <Select name={`property_${i}`} defaultValue={v(`property_${i}`)}>
                  <option value="">None</option>
                  {properties
                    .filter((p) => p.entity_id === owner)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Debit ($)">
                <Input name={`debit_${i}`} inputMode="decimal" value={amounts[i].d} onChange={(e) => set(i, "d", e.target.value)} />
              </Field>
              <Field label="Credit ($)">
                <Input name={`credit_${i}`} inputMode="decimal" value={amounts[i].c} onChange={(e) => set(i, "c", e.target.value)} />
              </Field>
            </div>
          ))}
          {rows < 12 && (
            <button type="button" onClick={() => setRows(rows + 1)} className="text-[13px] font-semibold text-accent hover:underline">
              + Add a line
            </button>
          )}
          <p className={`text-sm font-semibold ${debits === credits && debits ? "text-accent" : "text-danger"}`}>
            Debits {fmt(debits)} · Credits {fmt(credits)} {debits === credits && debits ? "· Balanced" : `· Off by ${fmt(Math.abs(debits - credits))}`}
          </p>
        </div>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || debits !== credits || !debits}>
          {pending ? "Posting…" : "Post entry"}
        </Button>
      </div>
    </form>
  );
}
