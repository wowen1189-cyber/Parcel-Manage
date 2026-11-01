"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { closeMonth, emailStatement, markDistributionPaid, saveReserve, type CloseState } from "./statement-actions";

const empty: CloseState = {};
function Status({ state }: { state: CloseState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function CloseMonthForm({ entityId, month, disabled }: { entityId: string; month: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(closeMonth, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="month" value={month} />
      <Status state={state} />
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Closing…" : "Post fees and close the month"}
      </Button>
    </form>
  );
}

export function PayDistributionForm({ id, today }: { id: string; today: string }) {
  const [state, action, pending] = useActionState(markDistributionPaid, empty);
  if (state.message) return <span className="text-[13px] text-accent">{state.message}</span>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Input type="date" name="paid_on" defaultValue={today} aria-label="Paid on" className="w-40" />
      <Select name="method" defaultValue="ach" aria-label="How" className="w-28">
        <option value="ach">ACH</option>
        <option value="check">Check</option>
        <option value="other">Other</option>
      </Select>
      <Input name="reference" placeholder="Check #" aria-label="Reference" className="w-28" />
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark paid"}
      </Button>
    </form>
  );
}

export function EmailStatementButton({ id, sent }: { id: string; sent: boolean }) {
  const [state, action, pending] = useActionState(emailStatement, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Status state={state} />
      <Button type="submit" small variant={sent ? "secondary" : "primary"} disabled={pending}>
        {pending ? "Sending…" : sent ? "Send again" : "E-mail to owner"}
      </Button>
    </form>
  );
}

export function ReserveForm({ entityId, reserve }: { entityId: string; reserve: string }) {
  const [state, action, pending] = useActionState(saveReserve, empty);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="entity_id" value={entityId} />
      <Field label="Cash reserve kept back ($)">
        <Input name="reserve" inputMode="decimal" defaultValue={reserve} className="w-40" />
      </Field>
      <Button type="submit" small variant="secondary" disabled={pending}>
        Save
      </Button>
      {state.message && <span className="text-[13px] text-accent">{state.message}</span>}
      {state.error && <span className="text-[13px] text-danger">{state.error}</span>}
    </form>
  );
}
