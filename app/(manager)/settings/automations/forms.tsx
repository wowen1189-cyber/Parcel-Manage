"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { AutomationSettings } from "@/lib/automation-rules";
import { runAutomationsNow, saveAutomations, type AutomationState } from "./actions";

const empty: AutomationState = {};

function Toggle({ name, on, label, hint }: { name: string; on: boolean; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={on} className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="text-[13px] text-subtle">{hint}</span>
      </span>
    </label>
  );
}

export function AutomationsForm({ s, canEdit }: { s: AutomationSettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveAutomations, empty);
  return (
    <form action={action} className="space-y-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="rounded-[var(--radius-card)] border border-line-strong p-4">
        <Toggle name="enabled" on={s.enabled} label="Turn automations on" hint="Leave off until you've finished switching from your old software, so tenants don't get two sets of reminders." />
      </div>
      <fieldset disabled={!canEdit} className="space-y-4">
        <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-subtle">Sent automatically (routine)</legend>
        <Toggle name="rentReminders" on={s.rentReminders} label="Rent reminders" hint="A friendly e-mail before rent is due. Skipped for tenants on autopay." />
        <div className="max-w-[240px] pl-8">
          <Field label="Days before the due date">
            <Input name="rentReminderDaysBefore" type="number" min={1} max={10} defaultValue={s.rentReminderDaysBefore} />
          </Field>
        </div>
        <Toggle name="insuranceReminders" on={s.insuranceReminders} label="Renters insurance expiring" hint="E-mails the tenant to renew and upload the new policy." />
        <div className="max-w-[240px] pl-8">
          <Field label="Days before it expires">
            <Input name="insuranceReminderDays" type="number" min={7} max={60} defaultValue={s.insuranceReminderDays} />
          </Field>
        </div>
        <Toggle name="visitReminders" on={s.visitReminders} label="Repair visit reminders" hint="The day before a scheduled repair. The 24-hour entry notice itself goes out when the visit is scheduled." />
      </fieldset>
      <fieldset disabled={!canEdit} className="space-y-4">
        <legend className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-subtle">Drafted for you to approve (legal notices are never sent automatically)</legend>
        <Toggle name="lateNoticeTasks" on={s.lateNoticeTasks} label="Past-due rent" hint="From the late-fee day, a To do to prepare the 3-day notice (Fla. Stat. 83.56(3))." />
        <Toggle name="renewalTasks" on={s.renewalTasks} label="Renewals and end-of-term notices" hint="A To do to offer a renewal or send non-renewal (83.575(1)), and to send the 83.575(2) reminder in its 15-day window." />
        <p className="text-[13px] text-subtle">A To do also appears when a repair visit tomorrow still needs its 24-hour entry notice (83.53(2)).</p>
      </fieldset>
      {canEdit && (
        <Button type="submit" small disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}

export function RunNow() {
  const [state, action, pending] = useActionState(runAutomationsNow, empty);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Running…" : "Run today's automations now"}
      </Button>
      {state.message && <p className="text-[13px] text-accent">{state.message}</p>}
      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
    </form>
  );
}
