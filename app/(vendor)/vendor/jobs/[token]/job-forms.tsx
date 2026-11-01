"use client";

import { createClient } from "@supabase/supabase-js";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { acceptJob, declineJob, finishJob, scheduleJob, startJobUpload, type JobState } from "./actions";

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

async function upload(token: string, kind: "photo" | "invoice", file: File) {
  const start = await startJobUpload({ token, kind, type: file.type, size: file.size });
  if (!start.path || !start.uploadToken) throw new Error(start.error ?? "The upload couldn't start.");
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
  const up = await storage.from("documents").uploadToSignedUrl(start.path, start.uploadToken, file, { contentType: file.type });
  if (up.error) throw new Error("A file didn't upload. Please try again.");
  return start.path;
}

export function FinishForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(finishJob, empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    try {
      const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      const invoice = form.get("invoice");
      form.delete("photos");
      form.delete("invoice");
      for (const f of photos.slice(0, 8)) form.append("photo_path", await upload(token, "photo", f));
      if (invoice instanceof File && invoice.size) form.set("invoice_path", await upload(token, "invoice", invoice));
      action(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Status state={state} />
      <Field label="What did you do?">
        <Textarea name="resolution" defaultValue={state.values?.resolution} placeholder="Replaced the capacitor; AC cooling at 72°F." />
      </Field>
      <Field label="Photos (optional)">
        <Input type="file" name="photos" accept="image/*" multiple className="py-2.5" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Invoice (PDF or photo)">
          <Input type="file" name="invoice" accept="application/pdf,image/*" className="py-2.5" />
        </Field>
        <Field label="Invoice total ($)">
          <Input name="amount" inputMode="decimal" defaultValue={state.values?.amount} />
        </Field>
        <Field label="Invoice number">
          <Input name="invoice_number" defaultValue={state.values?.invoice_number} />
        </Field>
      </div>
      <Button type="submit" disabled={pending || busy}>
        {pending || busy ? "Sending…" : "Mark done"}
      </Button>
    </form>
  );
}
