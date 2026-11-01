"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { postOpeningBalances, runBillingNow, saveBillingStart, type BillingState } from "./actions";

const empty: BillingState = {};

function Status({ state }: { state: BillingState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function BillingStartForm({ startsMonth, canEdit }: { startsMonth: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveBillingStart, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      <fieldset disabled={!canEdit} className="flex flex-wrap items-end gap-3">
        <Field label="First month Parcel Manage bills">
          <Input type="month" name="starts_month" defaultValue={startsMonth} className="w-48" />
        </Field>
        <Button type="submit" small disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {startsMonth && (
          <Button type="submit" name="off" value="1" small variant="ghost" disabled={pending}>
            Turn off
          </Button>
        )}
      </fieldset>
    </form>
  );
}

export function RunBillingButton({ canEdit }: { canEdit: boolean }) {
  const [state, action, pending] = useActionState(runBillingNow, empty);
  return (
    <form action={action} className="space-y-2">
      <Status state={state} />
      <Button type="submit" small variant="secondary" disabled={pending || !canEdit}>
        {pending ? "Running…" : "Run today's billing now"}
      </Button>
    </form>
  );
}

export function OpeningBalancesForm({ defaultDate, canEdit }: { defaultDate: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(postOpeningBalances, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      <fieldset disabled={!canEdit} className="space-y-3">
        <Field label="Cutover date" hint="The date of the AppFolio balances you imported">
          <Input type="date" name="as_of" defaultValue={defaultDate} className="w-48" />
        </Field>
        <label className="flex min-h-10 items-center gap-3 text-sm">
          <input type="checkbox" name="deposits" defaultChecked className="size-[18px] accent-[var(--color-accent)]" />
          Also record each lease&apos;s security deposit as held in trust
        </label>
        <Button type="submit" small disabled={pending}>
          {pending ? "Posting…" : "Post AppFolio balances to the books"}
        </Button>
      </fieldset>
    </form>
  );
}
