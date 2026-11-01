"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { PAYMENT_METHOD_LABEL, VENDOR_TRADES } from "@/lib/vendors";
import { createVendor, updateVendor, type FormState } from "./actions";

export type VendorValues = {
  id: string;
  contact_id: string;
  kind: string;
  business_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  contact_notes: string | null;
  trade: string | null;
  payment_method: string | null;
  is_1099: boolean;
  w9_on_file: boolean;
  w9_received_on: string | null;
  coi_expires_on: string | null;
  workers_comp_expires_on: string | null;
  auto_insurance_expires_on: string | null;
  license_expires_on: string | null;
  epa_cert_expires_on: string | null;
  contract_expires_on: string | null;
  dispatch_override: boolean;
  notes: string | null;
};

const empty: FormState = {};

function Checkbox({ name, label, defaultChecked, hint, disabled }: { name: string; label: string; defaultChecked: boolean; hint?: string; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 size-5 accent-[var(--color-accent)]" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

export function VendorForm({ vendor, canEdit, canOverride }: { vendor: VendorValues; canEdit: boolean; canOverride: boolean }) {
  const [state, action, pending] = useActionState(updateVendor, empty);
  const s = (key: keyof VendorValues) => state.values?.[key] ?? (vendor[key] == null ? "" : String(vendor[key]));
  // After a failed save, checkboxes show what was ticked (absent from the form data means unticked).
  const b = (key: keyof VendorValues) => (state.values ? state.values[key] === "on" : Boolean(vendor[key]));
  const [kind, setKind] = useState(s("kind"));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={vendor.id} />
      <input type="hidden" name="contact_id" value={vendor.contact_id} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {!canEdit && <Notice>Your role can view vendors but not change them.</Notice>}
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card>
          <CardHeader title="Contact" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="This is a">
              <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="business">Company</option>
                <option value="person">Person</option>
              </Select>
            </Field>
            {kind === "business" ? (
              <Field label="Company name">
                <Input name="business_name" defaultValue={s("business_name")} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <Input name="first_name" defaultValue={s("first_name")} />
                </Field>
                <Field label="Last name">
                  <Input name="last_name" defaultValue={s("last_name")} />
                </Field>
              </div>
            )}
            <Field label="Trade">
              <Select name="trade" defaultValue={s("trade") || "Other"}>
                {VENDOR_TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={s("email")} />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={s("phone")} />
            </Field>
            <Field label="Mobile">
              <Input name="mobile" type="tel" defaultValue={s("mobile")} />
            </Field>
            <Field label="Street address">
              <Input name="address_line1" defaultValue={s("address_line1")} />
            </Field>
            <Field label="Suite (optional)">
              <Input name="address_line2" defaultValue={s("address_line2")} />
            </Field>
            <div className="grid grid-cols-[1fr_80px_120px] gap-3 sm:col-span-2">
              <Field label="City">
                <Input name="city" defaultValue={s("city")} />
              </Field>
              <Field label="State">
                <Input name="state" maxLength={2} defaultValue={s("state")} />
              </Field>
              <Field label="ZIP">
                <Input name="postal_code" defaultValue={s("postal_code")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Contact notes" hint="Who to ask for, fax numbers, office hours.">
                <Textarea name="contact_notes" defaultValue={s("contact_notes")} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Paperwork" description="On-site vendors need a W-9 and current insurance before they can be sent a work order." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Checkbox name="w9_on_file" label="W-9 on file" defaultChecked={b("w9_on_file")} />
            <Field label="W-9 received">
              <Input name="w9_received_on" type="date" defaultValue={s("w9_received_on")} />
            </Field>
            <Field label="Liability insurance (COI) expires">
              <Input name="coi_expires_on" type="date" defaultValue={s("coi_expires_on")} />
            </Field>
            <Field label="Workers' comp expires" hint="Leave blank if exempt.">
              <Input name="workers_comp_expires_on" type="date" defaultValue={s("workers_comp_expires_on")} />
            </Field>
            <Field label="Auto insurance expires">
              <Input name="auto_insurance_expires_on" type="date" defaultValue={s("auto_insurance_expires_on")} />
            </Field>
            <Field label="State license expires">
              <Input name="license_expires_on" type="date" defaultValue={s("license_expires_on")} />
            </Field>
            <Field label="EPA certification expires" hint="For HVAC refrigerant work.">
              <Input name="epa_cert_expires_on" type="date" defaultValue={s("epa_cert_expires_on")} />
            </Field>
            <Field label="Contract expires">
              <Input name="contract_expires_on" type="date" defaultValue={s("contract_expires_on")} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                name="dispatch_override"
                label="Allow work orders even if paperwork is missing"
                hint={canOverride ? "Only admins can change this. Use sparingly." : "Only an admin can change this."}
                defaultChecked={b("dispatch_override")}
                disabled={!canOverride}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Pay by">
              <Select name="payment_method" defaultValue={s("payment_method")}>
                <option value="">Not set</option>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox name="is_1099" label="Send a 1099 each year" defaultChecked={b("is_1099")} />
            <div className="sm:col-span-2">
              <Field label="Office notes">
                <Textarea name="notes" defaultValue={s("notes")} />
              </Field>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save vendor"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function NewVendorForm() {
  const [state, action, pending] = useActionState(createVendor, empty);
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [kind, setKind] = useState(v("kind", "business"));
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Vendor" description="Add their W-9 and insurance on the next page; on-site vendors can't be sent work orders until both are on file." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">{state.error && <Notice tone="danger">{state.error}</Notice>}</div>
          <Field label="This is a">
            <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="business">Company</option>
              <option value="person">Person</option>
            </Select>
          </Field>
          {kind === "business" ? (
            <Field label="Company name">
              <Input name="business_name" required defaultValue={v("business_name")} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input name="first_name" defaultValue={v("first_name")} />
              </Field>
              <Field label="Last name">
                <Input name="last_name" defaultValue={v("last_name")} />
              </Field>
            </div>
          )}
          <Field label="Trade">
            <Select name="trade" defaultValue={v("trade", "Plumbing")}>
              {VENDOR_TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "business" ? (
            <Field label="Who to ask for (optional)">
              <Input name="contact_person" defaultValue={v("contact_person")} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={v("phone")} />
          </Field>
          <Field label="Mobile" hint="For texting work orders (opt-in required)">
            <Input name="mobile" type="tel" defaultValue={v("mobile")} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={v("email")} />
          </Field>
          <Field label="Pay by">
            <Select name="payment_method" defaultValue={v("payment_method", "ach")}>
              <option value="">Not set</option>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox name="is_1099" label="Send a 1099 each year" defaultChecked={state.values ? state.values.is_1099 === "on" : true} />
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add vendor"}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
