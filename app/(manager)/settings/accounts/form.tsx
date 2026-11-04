"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { SECTIONS, TAX_LINES, TYPE_LABEL, type Account, type AccountType } from "@/lib/accounts";
import { saveAccount, type AccountState } from "./actions";

const empty: AccountState = {};
const TYPES = Object.keys(TYPE_LABEL) as AccountType[];

/** Add a new account (no `account`) or edit one. */
export function AccountForm({ account, onDone }: { account?: Account; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: AccountState, form: FormData) => {
    const next = await saveAccount(prev, form);
    if (next.message && onDone) onDone();
    return next;
  }, empty);
  const v = state.values;
  const [type, setType] = useState<AccountType>((v?.type as AccountType) ?? account?.type ?? "expense");
  const taxable = type === "income" || type === "expense";
  // A fresh form after each new account is added, so the boxes clear.
  return (
    <form key={account ? account.id : `new-${state.saved ?? 0}`} action={action} className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && !account && <Notice tone="success">{state.message}</Notice>}
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {!account && (
          <>
            <Field label="Kind of account">
              <Select name="type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Number" hint={`4 digits starting with ${{ asset: 1, liability: 2, equity: 3, income: 4, expense: 5 }[type]}`}>
              <Input name="number" inputMode="numeric" maxLength={4} defaultValue={v?.number ?? ""} placeholder={{ asset: "1450", liability: "2350", equity: "3300", income: "4087", expense: "5047" }[type]} />
            </Field>
          </>
        )}
        <Field label="Name">
          <Input name="name" defaultValue={v?.name ?? account?.name ?? ""} placeholder="Gutter cleaning" />
        </Field>
        <Field label="Listed under">
          <Select key={type} name="section" defaultValue={v?.section ?? account?.section ?? SECTIONS[type][0]}>
            {SECTIONS[type].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {taxable && (
          <Field label="Schedule E line" hint="Where it goes on the owner's tax return">
            <Select name="tax_line" defaultValue={v?.tax_line ?? account?.tax_line ?? ""}>
              <option value="">Not on Schedule E</option>
              {TAX_LINES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {account ? (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={v ? v.active === "on" : account.active} disabled={account.system} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
          {account.system && <input type="hidden" name="active" value="on" />}
          <span>
            <span className="font-semibold">Offer it for new entries</span>
            <span className="block text-subtle">{account.system ? "Parcel Manage posts to this account itself, so it always stays on." : "Untick to hide it from dropdowns. Past entries stay in the books and reports."}</span>
          </span>
        </label>
      ) : (
        <input type="hidden" name="active" value="on" />
      )}
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : account ? "Save" : "Add account"}
      </Button>
    </form>
  );
}

/** One row's Edit button that opens its form in place. */
export function EditAccount({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 px-2 text-[13px] font-semibold text-accent hover:underline">
        Edit<span className="sr-only"> {account.number} {account.name}</span>
      </button>
    );
  return (
    <div className="mt-2 w-full rounded-[var(--radius-control)] border border-line p-3">
      <AccountForm account={account} onDone={() => setOpen(false)} />
      <button type="button" onClick={() => setOpen(false)} className="mt-1 min-h-11 text-[13px] font-semibold text-muted hover:underline">
        Cancel
      </button>
    </div>
  );
}
