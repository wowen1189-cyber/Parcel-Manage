"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { saveHouseholdItem, updateLeaseNotes, updateLeaseTerms, updateTenantContact, type FormState } from "./actions";

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

// ---------- lease terms ----------

export type LeaseTermsValues = {
  late_fee_grace_days: number | null;
  late_fee_flat_cents: number | null;
  late_fee_pct: number | null;
  late_fee_basis: string | null;
  late_fee_daily_cents: number | null;
  late_fee_daily_max_cents: number | null;
  nsf_fee_cents: number | null;
  certified_funds_only: boolean;
  rent_reminders: boolean;
  next_rent_increase_on: string | null;
  next_rent_cents: number | null;
};

const dollars = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));

function Check({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 accent-[var(--color-accent)]" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

export function LeaseTermsForm({ leaseId, terms, companyDefault, canEdit }: { leaseId: string; terms: LeaseTermsValues; companyDefault: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateLeaseTerms, empty);
  const own = terms.late_fee_grace_days != null;
  const [source, setSource] = useState(state.values?.late_fee_source ?? (own ? "lease" : "company"));
  const initialType = terms.late_fee_pct != null ? (terms.late_fee_basis === "all_charges" ? "pct_all" : "pct_rent") : "flat";
  const [type, setType] = useState(state.values?.late_fee_type ?? initialType);
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const b = (k: string, fallback: boolean) => (state.values ? state.values[k] === "on" : fallback);

  return (
    <form action={action}>
      <input type="hidden" name="lease_id" value={leaseId} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <Status state={state} />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Late fee</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["company", "Company default", companyDefault],
              ["lease", "This lease's own terms", "Old lease, or a lease that came with a property"],
            ].map(([value, label, hint]) => (
              <label key={value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 ${source === value ? "border-accent bg-accent-softer" : "border-line-strong"}`}>
                <input type="radio" name="late_fee_source" value={value} checked={source === value} onChange={() => setSource(value)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-[13px] text-subtle">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {source === "lease" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Late after day" hint="e.g. 3 means late if unpaid after the 3rd">
              <Input name="late_fee_grace_days" inputMode="numeric" defaultValue={v("late_fee_grace_days", String(terms.late_fee_grace_days ?? 3))} />
            </Field>
            <Field label="Fee type">
              <Select name="late_fee_type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="flat">Flat amount</option>
                <option value="pct_rent">Percent of rent</option>
                <option value="pct_all">Percent of all charges</option>
              </Select>
            </Field>
            <Field label={type === "flat" ? "Late fee ($)" : "Late fee (%)"}>
              <Input
                name="late_fee_amount"
                inputMode="decimal"
                defaultValue={v("late_fee_amount", type === "flat" ? dollars(terms.late_fee_flat_cents) : terms.late_fee_pct != null ? String(Number(terms.late_fee_pct)) : "")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Then per day ($)" hint="Optional">
                <Input name="late_fee_daily" inputMode="decimal" defaultValue={v("late_fee_daily", dollars(terms.late_fee_daily_cents))} />
              </Field>
              <Field label="Daily fees up to ($)" hint="Optional">
                <Input name="late_fee_daily_max" inputMode="decimal" defaultValue={v("late_fee_daily_max", dollars(terms.late_fee_daily_max_cents))} />
              </Field>
            </div>
          </div>
        )}
        {source === "company" && (
          <>
            <input type="hidden" name="late_fee_type" value="flat" />
            <input type="hidden" name="late_fee_grace_days" value="" />
            <input type="hidden" name="late_fee_amount" value="" />
            <input type="hidden" name="late_fee_daily" value="" />
            <input type="hidden" name="late_fee_daily_max" value="" />
          </>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Returned payment fee ($)" hint="As stated in the lease">
            <Input name="nsf_fee" inputMode="decimal" defaultValue={v("nsf_fee", dollars(terms.nsf_fee_cents))} />
          </Field>
          <Field label="Next rent increase on">
            <Input name="next_rent_increase_on" type="date" defaultValue={v("next_rent_increase_on", terms.next_rent_increase_on ?? "")} />
          </Field>
          <Field label="New rent ($)">
            <Input name="next_rent" inputMode="decimal" defaultValue={v("next_rent", dollars(terms.next_rent_cents))} />
          </Field>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <Check name="certified_funds_only" label="Certified funds only" hint="Money order or cashier's check" defaultChecked={b("certified_funds_only", terms.certified_funds_only)} />
          <Check name="rent_reminders" label="Send rent reminders" defaultChecked={b("rent_reminders", terms.rent_reminders)} />
        </div>
        <p className="text-[13px] text-subtle">Enter the terms the tenant actually signed. Florida law sets no late-fee amount for homes; the signed lease controls.</p>
        <div className="flex justify-end">
          <Button type="submit" small disabled={pending}>
            {pending ? "Saving…" : "Save terms"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

// ---------- household items ----------

export type HouseholdTable = "renters_insurance" | "vehicle" | "pet" | "emergency_contact";
type Person = { id: string; name: string };

export function HouseholdItemForm({
  table,
  leaseId,
  people,
  item,
  canEdit,
}: {
  table: HouseholdTable;
  leaseId: string;
  people: Person[];
  item?: Record<string, string | number | boolean | null>;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveHouseholdItem, empty);
  const v = (k: string) => state.values?.[k] ?? (item?.[k] == null ? "" : String(item[k]));
  const b = (k: string) => (state.values ? state.values[k] === "on" : Boolean(item?.[k]));
  const owner = (label: string) => (
    <Field label={label}>
      <Select name="tenant_contact_id" defaultValue={v("tenant_contact_id") || people[0]?.id}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Field>
  );
  return (
    <form action={action}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={String(item?.id ?? "")} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Status state={state} />
        </div>
        {table === "renters_insurance" && (
          <>
            {owner("Policyholder")}
            <Field label="Insurance company">
              <Input name="carrier" defaultValue={v("carrier")} />
            </Field>
            <Field label="Policy number">
              <Input name="policy_number" defaultValue={v("policy_number")} autoComplete="off" />
            </Field>
            <Field label="Expires">
              <Input name="expires_on" type="date" defaultValue={v("expires_on")} />
            </Field>
            <Field label="Liability coverage ($)" hint="Your lease requires at least $100,000">
              <Input name="liability" inputMode="decimal" defaultValue={item?.liability_cents != null && !state.values ? (Number(item.liability_cents) / 100).toFixed(0) : (state.values?.liability ?? "")} />
            </Field>
            <Check name="company_is_interested_party" label="We're listed as interested party" defaultChecked={b("company_is_interested_party")} />
          </>
        )}
        {table === "vehicle" && (
          <>
            {owner("Driver")}
            <Field label="Year, make and model">
              <Input name="make_model" defaultValue={v("make_model")} placeholder="2019 Toyota Camry" />
            </Field>
            <Field label="Color">
              <Input name="color" defaultValue={v("color")} />
            </Field>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Field label="Plate">
                <Input name="tag_number" defaultValue={v("tag_number")} autoComplete="off" />
              </Field>
              <Field label="State">
                <Input name="tag_state" maxLength={2} defaultValue={v("tag_state") || "FL"} />
              </Field>
            </div>
            <Field label="Parking permit #">
              <Input name="parking_permit_number" defaultValue={v("parking_permit_number")} />
            </Field>
          </>
        )}
        {table === "pet" && (
          <>
            <Field label="Kind" hint="Cat, Labrador, Pug…">
              <Input name="kind" defaultValue={v("kind")} />
            </Field>
            <Field label="Name">
              <Input name="name" defaultValue={v("name")} />
            </Field>
            <Field label="Weight (lbs)">
              <Input name="weight_lbs" inputMode="decimal" defaultValue={v("weight_lbs")} />
            </Field>
            <Check name="is_assistance_animal" label="Assistance animal" hint="Not a pet: no pet rent, fee or limits apply" defaultChecked={b("is_assistance_animal")} />
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Input name="notes" defaultValue={v("notes")} />
              </Field>
            </div>
          </>
        )}
        {table === "emergency_contact" && (
          <>
            {owner("Emergency contact for")}
            <Field label="Name">
              <Input name="name" defaultValue={v("name")} />
            </Field>
            <Field label="Relationship">
              <Input name="relationship" defaultValue={v("relationship")} placeholder="Mother, friend…" />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={v("phone")} />
            </Field>
          </>
        )}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" small disabled={pending}>
            {pending ? "Saving…" : item ? "Save" : "Add"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
