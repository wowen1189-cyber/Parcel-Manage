"use client";

import { createClient } from "@supabase/supabase-js";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { giveNotice, saveHousehold, saveInsurance, setTexts, startInsuranceUpload, type PortalState } from "../actions";

const empty: PortalState = {};

function Status({ state }: { state: PortalState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function VehicleForm() {
  const [state, action, pending] = useActionState(saveHousehold, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value="vehicle" />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Year, make and model">
          <Input name="make_model" placeholder="2020 Honda Civic" />
        </Field>
        <Field label="Color">
          <Input name="color" />
        </Field>
        <Field label="Tag number">
          <Input name="tag_number" />
        </Field>
        <Field label="Tag state">
          <Input name="tag_state" defaultValue="FL" maxLength={2} />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Add vehicle"}
      </Button>
    </form>
  );
}

export function EmergencyContactForm() {
  const [state, action, pending] = useActionState(saveHousehold, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value="emergency" />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <Input name="name" />
        </Field>
        <Field label="Relationship">
          <Input name="relationship" placeholder="Sister" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Add contact"}
      </Button>
    </form>
  );
}

export function InsuranceForm({ holder }: { holder: string }) {
  const [state, action, pending] = useActionState(saveInsurance, empty);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(form: FormData) {
    setError(null);
    const file = form.get("file");
    form.delete("file");
    if (file instanceof File && file.size) {
      setUploading(true);
      const start = await startInsuranceUpload({ type: file.type, size: file.size });
      if (!start.path || !start.token) {
        setUploading(false);
        return setError(start.error ?? "The upload couldn't start.");
      }
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }).storage;
      const up = await storage.from("documents").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      setUploading(false);
      if (up.error) return setError("The file didn't upload. Please try again.");
      form.set("path", start.path);
    }
    action(form);
  }
  return (
    <form action={submit} className="space-y-3">
      {error && <Notice tone="danger">{error}</Notice>}
      <Status state={state} />
      <p className="text-[14px] text-muted">
        List <strong className="text-ink">{holder}</strong> as an interested party on your policy, then upload the declarations page.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Insurance company">
          <Input name="carrier" defaultValue={state.values?.carrier} />
        </Field>
        <Field label="Policy number">
          <Input name="policy_number" defaultValue={state.values?.policy_number} />
        </Field>
        <Field label="Policy ends">
          <Input type="date" name="expires_on" defaultValue={state.values?.expires_on} />
        </Field>
      </div>
      <Field label="Declarations page (PDF or photo)">
        <Input type="file" name="file" accept="application/pdf,image/*" className="py-2.5" />
      </Field>
      <Button type="submit" small disabled={pending || uploading}>
        {pending || uploading ? "Sending…" : "Send proof of insurance"}
      </Button>
    </form>
  );
}

export function NoticeForm({ minDate, noticeText }: { minDate: string; noticeText: string }) {
  const [state, action, pending] = useActionState(giveNotice, empty);
  return (
    <form action={action} className="space-y-3">
      <Status state={state} />
      <p className="text-[14px] text-muted">{noticeText}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Move-out date">
          <Input type="date" name="move_out_on" min={minDate} defaultValue={state.values?.move_out_on} />
        </Field>
        <Field label="Forwarding address" hint="For your deposit return">
          <Input name="forwarding" defaultValue={state.values?.forwarding} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
        I&apos;m giving written notice that I&apos;ll move out on this date.
      </label>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send notice to vacate"}
      </Button>
    </form>
  );
}

export function TextsForm({ on, mobile, consent }: { on: boolean; mobile: string | null; consent: string }) {
  const [state, action, pending] = useActionState(setTexts, empty);
  return (
    <form action={action} className="space-y-3 px-5 py-4 text-[14px]">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {on ? (
        <>
          <p>
            Texts are on for <span className="font-semibold">{mobile}</span>.
          </p>
          <input type="hidden" name="texts" value="off" />
          <Button type="submit" small variant="secondary" disabled={pending}>
            Turn texts off
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="texts" value="on" />
          <Field label="Mobile number">
            <Input name="mobile" type="tel" inputMode="tel" autoComplete="tel" defaultValue={state.values?.mobile ?? mobile ?? ""} />
          </Field>
          <label className="flex min-h-11 items-start gap-3">
            <input type="checkbox" name="agree" className="mt-0.5 size-[18px] shrink-0 accent-[var(--color-accent)]" />
            <span>{consent}</span>
          </label>
          <Button type="submit" small disabled={pending}>
            Turn texts on
          </Button>
        </>
      )}
    </form>
  );
}
