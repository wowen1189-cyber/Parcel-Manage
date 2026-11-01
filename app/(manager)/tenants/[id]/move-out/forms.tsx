"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { claimDeposit, recordClaimNotice, saveDeductions, settleDeposit, startMoveOut, type MoveOutState } from "./actions";

const empty: MoveOutState = {};
function Status({ state }: { state: MoveOutState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function StartForm({ leaseId, today, defaultDate }: { leaseId: string; today: string; defaultDate: string }) {
  const [state, action, pending] = useActionState(startMoveOut, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lease_id" value={leaseId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date the tenant moved out and returned keys">
          <Input type="date" name="vacated_on" defaultValue={defaultDate} max={today} />
        </Field>
        <Field label="Forwarding address" hint="Where the deposit or claim notice goes">
          <Input name="forwarding_address" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record move-out"}
      </Button>
    </form>
  );
}

export function DeductionsForm({ moveOutId, deductions, notes, locked }: { moveOutId: string; deductions: { description: string; amount_cents: number }[]; notes: string; locked: boolean }) {
  const [state, action, pending] = useActionState(saveDeductions, empty);
  const [rows, setRows] = useState(Math.max(deductions.length + 1, 3));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="move_out_id" value={moveOutId} />
      <Status state={state} />
      <fieldset disabled={locked} className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <Input name={`desc_${i}`} defaultValue={deductions[i]?.description ?? ""} placeholder="Replace stained carpet in bedroom 2" aria-label={`Deduction ${i + 1}`} />
            <Input name={`amount_${i}`} inputMode="decimal" defaultValue={deductions[i] ? (deductions[i].amount_cents / 100).toFixed(2) : ""} placeholder="$" aria-label={`Amount ${i + 1}`} />
          </div>
        ))}
        {rows < 15 && (
          <button type="button" onClick={() => setRows(rows + 1)} className="text-[13px] font-semibold text-accent hover:underline">
            + Add a line
          </button>
        )}
        <Field label="Inspection notes" hint="Condition room by room; normal wear and tear can't be charged.">
          <Textarea name="inspection_notes" defaultValue={notes} />
        </Field>
        <Button type="submit" small variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </fieldset>
    </form>
  );
}

export function ClaimButton({ moveOutId, disabled }: { moveOutId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(claimDeposit, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="move_out_id" value={moveOutId} />
      <Status state={state} />
      <Button type="submit" small disabled={pending || disabled}>
        {pending ? "Posting…" : "Claim these deductions"}
      </Button>
    </form>
  );
}

export function NoticeSentForm({ moveOutId, today, messages }: { moveOutId: string; today: string; messages: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(recordClaimNotice, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="move_out_id" value={moveOutId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sent on">
          <Input type="date" name="sent_on" defaultValue={today} max={today} />
        </Field>
        <Field label="How">
          <Select name="method" defaultValue="certified_mail">
            <option value="certified_mail">Certified mail</option>
            <option value="email_addendum">E-mail (tenant signed the 83.505 addendum)</option>
          </Select>
        </Field>
        <Field label="The filed notice">
          <Select name="message_id" defaultValue={messages[0]?.id ?? ""}>
            <option value="">Not filed here</option>
            {messages.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Record the notice"}
      </Button>
    </form>
  );
}

export function SettleForm({ moveOutId, decision, today, summary }: { moveOutId: string; decision: "return_full" | "claim"; today: string; summary: string }) {
  const [state, action, pending] = useActionState(settleDeposit, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="move_out_id" value={moveOutId} />
      <input type="hidden" name="decision" value={decision} />
      <Status state={state} />
      <p className="text-sm">{summary}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Refund sent on">
          <Input type="date" name="paid_on" defaultValue={today} />
        </Field>
        <Field label="Check or reference #">
          <Input name="reference" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : decision === "return_full" ? "Record full refund" : "Apply the claim and record the refund"}
      </Button>
    </form>
  );
}
