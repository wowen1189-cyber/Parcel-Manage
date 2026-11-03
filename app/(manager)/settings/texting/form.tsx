"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { saveTexting, type TextingState } from "./actions";

const empty: TextingState = {};

export function TextingForm({ from, alert, live, canGoLive, canEdit }: { from: string; alert: string; live: boolean; canGoLive: boolean; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveTexting, empty);
  return (
    <form action={action} className="space-y-4 px-5 py-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Field label="Texting number" hint="The local number bought in Twilio for this company. Tenants and vendors see texts from it and can text back.">
        <Input name="sms_from_number" defaultValue={state.values?.sms_from_number ?? from} placeholder="(352) 555-0100" inputMode="tel" disabled={!canEdit} />
      </Field>
      <Field label="Emergency alert mobile" hint="Gets a text when a tenant reports an emergency repair in the portal. Use the on-call person's own mobile, with their OK.">
        <Input name="sms_alert_number" defaultValue={state.values?.sms_alert_number ?? alert} placeholder="(352) 555-0101" inputMode="tel" disabled={!canEdit} />
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="sms_live" defaultChecked={state.values ? state.values.sms_live === "on" : live} disabled={!canEdit || (!canGoLive && !live)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
        <span>
          <span className="font-semibold">Send real texts</span>
          <span className="block text-subtle">Off: texts are saved and shown as practice, and nobody gets them. Turn on only after Twilio approves your texting registration (A2P 10DLC).</span>
        </span>
      </label>
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}
