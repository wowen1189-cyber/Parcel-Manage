"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { updateLeaseNotes, updateTenantContact, type FormState } from "./actions";

const empty: FormState = {};

export type TenantContactValues = {
  id: string;
  kind: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  preferred_contact: string | null;
};

function Status({ state }: { state: FormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function TenantContactForm({ leaseId, contact, canEdit }: { leaseId: string; contact: TenantContactValues; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateTenantContact, empty);
  const [kind, setKind] = useState(state.values?.kind ?? contact.kind);
  const v = (key: keyof TenantContactValues) => state.values?.[key] ?? contact[key] ?? "";
  return (
    <form action={action}>
      <input type="hidden" name="contact_id" value={contact.id} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Status state={state} />
        </div>
        <Field label="This is a">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="person">Person</option>
            <option value="business">Business</option>
          </Select>
        </Field>
        {kind === "business" ? (
          <Field label="Business name">
            <Input name="business_name" defaultValue={v("business_name")} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input name="first_name" defaultValue={v("first_name")} autoComplete="off" />
            </Field>
            <Field label="Last name">
              <Input name="last_name" defaultValue={v("last_name")} autoComplete="off" />
            </Field>
          </div>
        )}
        <Field label="Email">
          <Input name="email" type="email" defaultValue={v("email")} autoComplete="off" />
        </Field>
        <Field label="Mobile">
          <Input name="mobile" type="tel" defaultValue={v("mobile")} autoComplete="off" />
        </Field>
        <Field label="Other phone">
          <Input name="phone" type="tel" defaultValue={v("phone")} autoComplete="off" />
        </Field>
        <Field label="Prefers" hint="Texts go only to people who opted in, and STOP is always honored.">
          <Select name="preferred_contact" defaultValue={v("preferred_contact")}>
            <option value="">No preference</option>
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="call">Call</option>
          </Select>
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" small disabled={pending}>
            {pending ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function LeaseNotesForm({ leaseId, unitId, notes, accessNotes, canEdit }: { leaseId: string; unitId: string; notes: string | null; accessNotes: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateLeaseNotes, empty);
  return (
    <form action={action}>
      <input type="hidden" name="lease_id" value={leaseId} />
      <input type="hidden" name="unit_id" value={unitId} />
      <fieldset disabled={!canEdit} className="space-y-3 p-5">
        <Status state={state} />
        <Field label="Door code and keys" hint="Staff only. Never shown to tenants, vendors or owners.">
          <Input name="access_notes" defaultValue={state.values?.access_notes ?? accessNotes ?? ""} autoComplete="off" />
        </Field>
        <Field label="Office notes">
          <Textarea name="notes" defaultValue={state.values?.notes ?? notes ?? ""} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" small disabled={pending}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
