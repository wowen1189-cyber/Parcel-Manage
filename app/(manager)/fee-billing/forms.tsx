"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { approveFeeBill, createFeeBills, emailFeeBill, payFeeBill, setUpManager, voidFeeBill, type FeeState } from "./actions";

const empty: FeeState = {};
function Status({ state }: { state: FeeState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function SetUpManagerForm({ suggested }: { suggested: string }) {
  const [state, action, pending] = useActionState(setUpManager, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Management company name">
          <Input name="name" defaultValue={suggested} className="w-72" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Setting up…" : "Set up its books"}
        </Button>
      </div>
    </form>
  );
}

export function CreateBillsForm({ month, disabled }: { month: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(createFeeBills, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="month" value={month} />
      <Status state={state} />
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Making bills…" : "Make draft bills for this month"}
      </Button>
    </form>
  );
}

export function BillActions({ id, status, sent, today }: { id: string; status: string; sent: boolean; today: string }) {
  const [approveState, approve, approving] = useActionState(approveFeeBill.bind(null, id), empty);
  const [payState, pay, paying] = useActionState(payFeeBill.bind(null, id), empty);
  const [voidState, voidIt, voiding] = useActionState(voidFeeBill.bind(null, id), empty);
  const [mailState, mail, mailing] = useActionState(emailFeeBill.bind(null, id), empty);
  return (
    <div className="space-y-4">
      {[approveState, payState, voidState, mailState].map((s, i) => (
        <Status key={i} state={s} />
      ))}
      {status === "draft" && (
        <form action={approve}>
          <p className="mb-2 text-[13px] text-muted">Approving posts the fees to the owner&apos;s books (owed to the management company) and to the management company&apos;s books (earned).</p>
          <Button type="submit" disabled={approving}>
            {approving ? "Posting…" : "Approve and post"}
          </Button>
        </form>
      )}
      {status === "approved" && (
        <form action={pay} className="flex flex-wrap items-end gap-2">
          <Field label="Paid on">
            <Input type="date" name="paid_on" defaultValue={today} className="w-40" />
          </Field>
          <Field label="How">
            <Select name="method" defaultValue="transfer" className="w-36">
              <option value="transfer">Bank transfer</option>
              <option value="ach">ACH</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Reference">
            <Input name="reference" placeholder="Check # or confirmation" className="w-48" />
          </Field>
          <Button type="submit" disabled={paying}>
            {paying ? "Recording…" : "Record payment"}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {(status === "approved" || status === "paid") && (
          <form action={mail}>
            <Button type="submit" small variant="secondary" disabled={mailing}>
              {mailing ? "Sending…" : sent ? "E-mail again" : "E-mail to owner"}
            </Button>
          </form>
        )}
        {(status === "draft" || status === "approved") && (
          <form action={voidIt}>
            <Button type="submit" small variant="secondary" disabled={voiding}>
              {voiding ? "Voiding…" : status === "approved" ? "Void (reverses the entries)" : "Void draft"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
