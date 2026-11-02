"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { acceptJob, checkIn, declineJob, scheduleJob, type JobState } from "./actions";

const empty: JobState = {};

function Status({ state }: { state: JobState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function AcceptDecline({ token }: { token: string }) {
  const [a, accept, accepting] = useActionState(acceptJob, empty);
  const [d, decline, declining] = useActionState(declineJob, empty);
  const [showDecline, setShowDecline] = useState(false);
  return (
    <div className="space-y-3">
      <Status state={a} />
      <Status state={d} />
      {!d.message && (
        <div className="flex flex-wrap gap-2">
          <form action={accept}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" disabled={accepting}>
              {accepting ? "Saving…" : "Accept job"}
            </Button>
          </form>
          <Button type="button" variant="secondary" onClick={() => setShowDecline(!showDecline)}>
            I can&apos;t take it
          </Button>
        </div>
      )}
      {showDecline && !d.message && (
        <form action={decline} className="space-y-2">
          <input type="hidden" name="token" value={token} />
          <Field label="Reason (optional)">
            <Input name="reason" placeholder="Booked this week" />
          </Field>
          <Button type="submit" small variant="secondary" disabled={declining}>
            {declining ? "Sending…" : "Decline job"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ScheduleForm({ token, earliest, emergency }: { token: string; earliest: string; emergency: boolean }) {
  const [state, action, pending] = useActionState(scheduleJob, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <Status state={state} />
      {!emergency && <p className="text-[14px] text-muted">Florida law: at least 24 hours&apos; notice to the tenant, and visits between 7:30 a.m. and 8:00 p.m. We notify the tenant as soon as you pick a time.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start">
          <Input type="datetime-local" name="start" min={emergency ? undefined : earliest} defaultValue={state.values?.start} />
        </Field>
        <Field label="About how long?">
          <Select name="hours" defaultValue={state.values?.hours ?? "2"}>
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
            <option value="4">4 hours</option>
            <option value="8">Most of the day</option>
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Scheduling…" : "Schedule visit"}
      </Button>
    </form>
  );
}

export function CheckInButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(checkIn.bind(null, token), empty);
  return (
    <form action={action} className="space-y-2">
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking in…" : "I'm here: check in"}
      </Button>
    </form>
  );
}
