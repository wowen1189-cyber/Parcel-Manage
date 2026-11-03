"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { ENTRY_BASIS_LABEL, NOTICE_METHOD_LABEL } from "@/lib/work-orders";
import { addNote, assignVendor, changePriority, chargeFalseEmergency, scheduleVisit, type FormState } from "./actions";

const empty: FormState = {};

function Status({ state }: { state: FormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export type VendorOption = { id: string; name: string; trade: string | null; canDispatch: boolean; issues: string[]; matchesTrade: boolean; email: string | null; texts: boolean };

export function AssignVendorForm({ workOrderId, vendors, currentVendorId }: { workOrderId: string; vendors: VendorOption[]; currentVendorId: string | null }) {
  const [state, action, pending] = useActionState(assignVendor, empty);
  const [vendorId, setVendorId] = useState(currentVendorId ?? "");
  const picked = vendors.find((v) => v.id === vendorId);
  const suggested = vendors.filter((v) => v.matchesTrade);
  const others = vendors.filter((v) => !v.matchesTrade);
  const option = (v: VendorOption) => (
    <option key={v.id} value={v.id}>
      {v.name}
      {v.trade ? ` · ${v.trade}` : ""}
      {v.canDispatch ? "" : " (paperwork missing)"}
    </option>
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Status state={state} />
      <Field label="Vendor">
        <Select name="vendor_id" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">Choose a vendor…</option>
          {suggested.length > 0 && <optgroup label="Matches this job">{suggested.map(option)}</optgroup>}
          <optgroup label="All vendors">{others.map(option)}</optgroup>
        </Select>
      </Field>
      {picked && !picked.canDispatch && <Notice tone="warn">Can&apos;t dispatch yet: {picked.issues.join(", ")}. Add their W-9 and insurance on the vendor page first.</Notice>}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="email_vendor" defaultChecked className="size-5 accent-[var(--color-accent)]" />
        Email the job to them now{picked?.email ? ` (${picked.email})` : picked ? " (no email on file)" : ""}
      </label>
      {picked?.texts && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="text_vendor" defaultChecked className="size-5 accent-[var(--color-accent)]" />
          Text the job to them too
        </label>
      )}
      <Button type="submit" small disabled={pending || !vendorId}>
        {pending ? "Assigning…" : currentVendorId ? "Change vendor" : "Assign vendor"}
      </Button>
    </form>
  );
}

export function ScheduleForm({
  workOrderId,
  emergency,
  vacant,
  earliest,
  current,
  hasTenantEmail,
  emailAddendum,
}: {
  workOrderId: string;
  emergency: boolean;
  vacant: boolean;
  earliest: string;
  current: { start: string; end: string; basis: string | null; method: string | null };
  hasTenantEmail: boolean;
  emailAddendum: boolean;
}) {
  const [state, action, pending] = useActionState(scheduleVisit, empty);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  const [basis, setBasis] = useState(v("entry_basis", current.basis ?? (emergency ? "emergency" : vacant ? "vacant" : "notice")));
  const bases = Object.entries(ENTRY_BASIS_LABEL).filter(([k]) => (k === "emergency" ? emergency : k === "vacant" ? vacant : true));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Visit starts">
          <Input type="datetime-local" name="start" defaultValue={v("start", current.start || earliest)} />
        </Field>
        <Field label="Ends">
          <Input type="datetime-local" name="end" defaultValue={v("end", current.end)} />
        </Field>
      </div>
      <Field label="Entry" hint="Florida 83.53(2): 24 hours' notice for repairs, 7:30 a.m. to 8:00 p.m., unless an emergency or the tenant agrees.">
        <Select name="entry_basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
          {bases.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {basis === "notice" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How notice was given">
            <Select name="notice_method" defaultValue={v("notice_method", current.method ?? (emailAddendum ? "email_addendum" : "posted"))}>
              {Object.entries(NOTICE_METHOD_LABEL)
                .filter(([k]) => k !== "email_addendum" || emailAddendum)
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Notice given at" hint="Leave blank for right now">
            <Input type="datetime-local" name="notice_at" defaultValue={v("notice_at", "")} />
          </Field>
        </div>
      )}
      {basis !== "notice" && <input type="hidden" name="notice_method" value="" />}
      {basis !== "notice" && <input type="hidden" name="notice_at" value="" />}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="email_tenants" defaultChecked={hasTenantEmail} disabled={!hasTenantEmail} className="size-5 accent-[var(--color-accent)]" />
        {hasTenantEmail ? (emailAddendum ? "Email the tenants (counts as notice: they signed the e-mail addendum)" : "Also email the tenants a courtesy copy") : "No tenant email on file"}
      </label>
      <Button type="submit" small disabled={pending}>
        {pending ? "Saving…" : "Save visit"}
      </Button>
    </form>
  );
}

export function NoteForm({ workOrderId }: { workOrderId: string }) {
  const [state, action, pending] = useActionState(addNote, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Status state={state} />
      <Textarea name="note" placeholder="Called the tenant, left a message…" className="min-h-16" />
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}

export function PriorityForm({ workOrderId, priority }: { workOrderId: string; priority: string }) {
  const [state, action, pending] = useActionState(changePriority, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Status state={state} />
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Priority">
          <Select name="priority" defaultValue={state.values?.priority ?? priority}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </Select>
        </Field>
        <Field label="Why">
          <Input name="reason" defaultValue={state.values?.reason} placeholder="Vendor confirmed it's not leaking anymore" />
        </Field>
      </div>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change priority"}
      </Button>
    </form>
  );
}

export function FalseEmergencyForm({ workOrderId, feeLabel }: { workOrderId: string; feeLabel: string }) {
  const [state, action, pending] = useActionState(chargeFalseEmergency, empty);
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <Status state={state} />
      <Field label="Vendor's emergency charge ($)" hint={`Added to the ${feeLabel} fee the tenant agreed to`}>
        <Input name="vendor_charge" inputMode="decimal" />
      </Field>
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Charging…" : "Charge the tenant"}
      </Button>
    </form>
  );
}
