"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { INSPECTION_LABEL, type AgreementTerms } from "@/lib/management-agreement";
import { endAgreement, saveAgreement, sendAgreement, type AgreementState } from "./actions";

const empty: AgreementState = {};
const dollars = (c: number) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function Check({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-[18px] shrink-0 accent-[var(--color-accent)]" />
      <span>
        {label}
        {hint && <span className="block text-[13px] text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

export function AgreementForm({
  id,
  terms,
  startDate,
  signer,
  ownerEmail,
  properties,
  included,
  canEdit,
  isAdmin,
  templates,
  templateId,
}: {
  id: string;
  terms: AgreementTerms;
  startDate: string;
  signer: { name: string | null; title: string | null; email: string | null };
  ownerEmail: string | null;
  properties: { id: string; name: string; address: string }[];
  included: string[];
  canEdit: boolean;
  isAdmin: boolean;
  templates: { id: string; name: string }[];
  templateId: string | null;
}) {
  const [state, action, pending] = useActionState(saveAgreement, empty);
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  const on = (k: string, d: boolean) => (state.values ? state.values[k] === "on" : d);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={!canEdit} className="space-y-5 p-5">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink-2">Properties covered</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {properties.map((p) => (
              <label key={p.id} className="flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" name="property_id" value={p.id} defaultChecked={included.includes(p.id)} className="mt-0.5 size-[18px] shrink-0 accent-[var(--color-accent)]" />
                <span>
                  {p.name}
                  <span className="block text-[13px] text-subtle">{p.address}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Agreement used" hint="Your own templates are under Management agreements › Templates.">
          <Select name="template_id" defaultValue={v("template_id", templateId ?? "")}>
            <option value="">Parcel Manage&apos;s Florida agreement</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start date">
            <Input type="date" name="start_date" defaultValue={v("start_date", startDate)} required />
          </Field>
          <Field label="Term">
            <Select name="term_years" defaultValue={v("term_years", String(terms.termYears))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} year{n === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notice to end (days)">
            <Input name="notice_days" inputMode="numeric" defaultValue={v("notice_days", String(terms.noticeDays))} />
          </Field>
        </div>
        <Check name="auto_renew" label="Renews each year unless either side gives notice" checked={on("auto_renew", terms.autoRenew)} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Signs for the owner">
            <Input name="signer_name" defaultValue={v("signer_name", signer.name ?? "")} placeholder="Full name" />
          </Field>
          <Field label="Title">
            <Input name="signer_title" defaultValue={v("signer_title", signer.title ?? "")} placeholder="Manager" />
          </Field>
          <Field label="Signer's e-mail" hint={ownerEmail ? `Blank uses ${ownerEmail}` : "The owner has no e-mail on file"}>
            <Input type="email" name="signer_email" defaultValue={v("signer_email", signer.email ?? "")} />
          </Field>
        </div>

        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink-2">Authority the owner gives you</p>
          <p className="mb-2 text-[13px] text-subtle">Collecting rent and deposits is always included.</p>
          <Check name="power_leasing" label="Advertise, screen and sign leases and renewals" checked={on("power_leasing", terms.leasing)} />
          <Check name="power_evictions" label="Serve notices and handle evictions" checked={on("power_evictions", terms.evictions)} />
          <Check name="power_contractors" label="Hire vendors, sign service contracts and order repairs" checked={on("power_contractors", terms.contractors)} />
          <Check name="power_disbursements" label="Pay the owner's mortgage, taxes, insurance and dues" hint="Charges the fee below for each property" checked={on("power_disbursements", terms.disbursements)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Spending limit without approval ($)">
            <Input name="approval_limit" inputMode="decimal" defaultValue={v("approval_limit", dollars(terms.approvalLimitCents))} />
          </Field>
          <Field label="Owner paid by this day (for the prior month)" hint="1 to 28">
            <Input name="distribution_day" inputMode="numeric" defaultValue={v("distribution_day", String(terms.distributionDay))} />
          </Field>
          <Field label="Reserve kept ($)">
            <Input name="reserve" inputMode="decimal" defaultValue={v("reserve", dollars(terms.reserveCents))} />
          </Field>
          <Field label="Paying obligations fee ($ per property a month)">
            <Input name="disbursement_fee" inputMode="decimal" defaultValue={v("disbursement_fee", dollars(terms.disbursementFeeCents))} />
          </Field>
          <Field label="Late W-9 fee ($)">
            <Input name="w9_fee" inputMode="decimal" defaultValue={v("w9_fee", dollars(terms.w9FeeCents))} />
          </Field>
          <Field label="Re-leasing guarantee (months)">
            <Input name="release_months" inputMode="numeric" defaultValue={v("release_months", String(terms.releaseMonths))} />
          </Field>
          <Field label="Exterior inspections">
            <Select name="inspection_frequency" defaultValue={v("inspection_frequency", terms.inspectionFrequency)}>
              {Object.entries(INSPECTION_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Eviction cost estimate">
            <Input name="eviction_estimate" defaultValue={v("eviction_estimate", terms.evictionEstimate)} />
          </Field>
          <Field label="Owner's liability insurance ($)">
            <Input name="owner_liability" inputMode="decimal" defaultValue={v("owner_liability", dollars(terms.ownerLiabilityCents))} />
          </Field>
          <Field label="Residential tenant liability ($)">
            <Input name="residential_liability" inputMode="decimal" defaultValue={v("residential_liability", dollars(terms.residentialLiabilityCents))} />
          </Field>
          <Field label="Commercial tenant liability ($)">
            <Input name="commercial_liability" inputMode="decimal" defaultValue={v("commercial_liability", dollars(terms.commercialLiabilityCents))} />
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          {isAdmin && (
            <Button type="submit" name="intent" value="defaults" variant="secondary" disabled={pending}>
              Save and use as my default terms
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function SendAgreement({ id }: { id: string }) {
  const [state, action, pending] = useActionState(sendAgreement, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {!state.message && (
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send to the owner for signature"}
        </Button>
      )}
    </form>
  );
}

export function EndAgreement({ id }: { id: string }) {
  const [state, action, pending] = useActionState(endAgreement, empty);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Ends on">
        <Input type="date" name="ended_on" required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Mark as ended
      </Button>
    </form>
  );
}
