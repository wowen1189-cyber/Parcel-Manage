"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { FREQUENCIES } from "@/lib/report-schedule";
import { scheduleReport, type ScheduleState } from "./actions";

const empty: ScheduleState = {};

export function ScheduleForm({ reportKey, owner, property }: { reportKey: string; owner: string; property: string }) {
  const [state, action, pending] = useActionState(scheduleReport, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="report_key" value={reportKey} />
      <input type="hidden" name="owner" value={owner} />
      <input type="hidden" name="property" value={property} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <Field label="How often">
          <Select name="frequency" defaultValue="monthly_5">
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Send to" hint="E-mail addresses, separated by commas. No login needed.">
          <Input name="recipients" />
        </Field>
      </div>
      <p className="text-[13px] text-subtle">Uses the owner and property chosen above. Each e-mail covers the period just ended, with a CSV attached.</p>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Schedule e-mail"}
      </Button>
    </form>
  );
}
