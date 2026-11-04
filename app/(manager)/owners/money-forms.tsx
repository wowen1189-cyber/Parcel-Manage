"use client";

import { useActionState, useState } from "react";
import { AccountSelect } from "@/components/account-select";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { AccountOption } from "@/lib/accounts";
import { OWNER_MONEY_LABEL, type OwnerMoneyKind } from "@/lib/owner-money";
import { recordOwnerMoney, saveBooksMode, type MoneyState } from "./money-actions";

const empty: MoneyState = {};
function Status({ state }: { state: MoneyState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function BooksModeForm({ entityId, mode, canEdit }: { entityId: string; mode: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveBooksMode, empty);
  return (
    <form action={action} className="space-y-3 px-5 py-4">
      <input type="hidden" name="entity_id" value={entityId} />
      <Status state={state} />
      <fieldset className="space-y-2" disabled={!canEdit}>
        <legend className="sr-only">How this owner&apos;s money works</legend>
        <label className="flex gap-3 rounded-[var(--radius-control)] border border-line p-3 text-sm">
          <input type="radio" name="books_mode" value="own_books" defaultChecked={mode === "own_books"} className="mt-1" />
          <span>
            <span className="font-semibold">Own books</span>
            <span className="block text-[13px] text-muted">Rent goes straight into this owner&apos;s own bank and stays there. No distributions: money taken out is an owner draw. Book cash must match the bank.</span>
          </span>
        </label>
        <label className="flex gap-3 rounded-[var(--radius-control)] border border-line p-3 text-sm">
          <input type="radio" name="books_mode" value="managed" defaultChecked={mode === "managed"} className="mt-1" />
          <span>
            <span className="font-semibold">Managed, with distributions</span>
            <span className="block text-[13px] text-muted">We hold the money in the owner&apos;s operating account and pay out what&apos;s left each month, split by ownership. Use for partnerships. A month only closes once the bank is reconciled, so every statement ties.</span>
          </span>
        </label>
      </fieldset>
      {canEdit && (
        <Button type="submit" small variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}

export function OwnerMoneyForm({ entityId, properties, accounts, today, mode }: { entityId: string; properties: { id: string; name: string }[]; accounts: AccountOption[]; today: string; mode: string }) {
  const [state, action, pending] = useActionState(recordOwnerMoney, empty);
  const [kind, setKind] = useState<OwnerMoneyKind>(mode === "own_books" ? "draw" : "contribution");
  const kinds = (Object.keys(OWNER_MONEY_LABEL) as OwnerMoneyKind[]).filter((k) => mode === "own_books" || k !== "draw");
  return (
    <form action={action} className="space-y-3 px-5 py-4">
      <input type="hidden" name="entity_id" value={entityId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What happened">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as OwnerMoneyKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {OWNER_MONEY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" name="entry_date" defaultValue={today} />
        </Field>
        {kind === "loan_payment" ? (
          <>
            <Field label="Interest ($)" hint="From the loan statement. This part is an expense.">
              <Input name="interest" inputMode="decimal" />
            </Field>
            <Field label="Principal ($)" hint="Pays down the loan; not an expense.">
              <Input name="principal" inputMode="decimal" />
            </Field>
          </>
        ) : (
          <Field label="Amount ($)">
            <Input name="amount" inputMode="decimal" />
          </Field>
        )}
        {kind === "paid_personally" && (
          <Field label="Expense">
            <AccountSelect accounts={accounts} defaultValue="5000" />
          </Field>
        )}
        <Field label="Property (optional)">
          <Select name="property_id" defaultValue="">
            <option value="">Whole owner</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note (optional)">
          <Input name="memo" maxLength={200} placeholder="e.g. Transfer to personal account" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post to the books"}
      </Button>
    </form>
  );
}
