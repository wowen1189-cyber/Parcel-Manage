"use client";

import { useActionState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { ESCALATION_CHOICES, RENEWAL_INCREASE_CHOICES, RENEWAL_TERM_CHOICES, withCurrent, type CommercialTerms } from "@/lib/commercial-terms";
import { saveCommercialTerms, type FormState } from "./actions";

const dollars = (c: number) => (c ? (c / 100).toFixed(2) : "");

/** The commercial deal terms as form fields (no <form>), for the new-lease screen and the lease page. */
export function CommercialTermsFields({ terms, values }: { terms: CommercialTerms; values?: Record<string, string> }) {
  const v = (k: string, d: string) => values?.[k] ?? d;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name (dba)" hint="Printed as Tenant: person, dba business">
          <Input name="business_name" defaultValue={v("business_name", terms.businessName)} placeholder="Sample Studio LLC" />
        </Field>
        <Field label="Permitted use" hint="What the tenant may use the space for">
          <Input name="permitted_use" defaultValue={v("permitted_use", terms.permittedUse)} placeholder="Hair and nail salon" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Yearly rent increase (%)" hint="On each lease anniversary">
          <Select name="annual_increase" defaultValue={v("annual_increase", String(terms.annualIncreasePercent))}>
            {withCurrent(ESCALATION_CHOICES, terms.annualIncreasePercent).map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "None (flat rent)" : `${n}% a year`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="CAM fee a month ($)" hint="Common area maintenance; 0 for none">
          <Input name="cam_monthly" inputMode="decimal" defaultValue={v("cam_monthly", dollars(terms.camMonthlyCents))} placeholder="0" />
        </Field>
        <Field label="Utilities a month ($)" hint="Pro rata share billed with rent; 0 if metered">
          <Input name="utilities_monthly" inputMode="decimal" defaultValue={v("utilities_monthly", dollars(terms.utilitiesMonthlyCents))} placeholder="0" />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="cam_fixed" defaultChecked={values ? values.cam_fixed === "on" : terms.camFixed} className="size-[18px] accent-[var(--color-accent)]" />
        CAM fee is fixed for the whole lease (otherwise the landlord can adjust it on 30 days&apos; notice)
      </label>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Renewal terms offered" hint="0 for no renewal option">
          <Input name="renewal_options" inputMode="numeric" defaultValue={v("renewal_options", String(terms.renewalOptions))} />
        </Field>
        <Field label="Each renewal">
          <Select name="renewal_term_months" defaultValue={v("renewal_term_months", String(terms.renewalTermMonths))}>
            {withCurrent(RENEWAL_TERM_CHOICES, terms.renewalTermMonths).map((n) => (
              <option key={n} value={n}>
                {n % 12 === 0 ? `${n / 12} year${n === 12 ? "" : "s"}` : `${n} months`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Renewal rent increase" hint="Over the last rent of the prior term">
          <Select name="renewal_increase" defaultValue={v("renewal_increase", String(terms.renewalIncreasePercent))}>
            {withCurrent(RENEWAL_INCREASE_CHOICES, terms.renewalIncreasePercent).map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Renewal notice (days before end)">
          <Input name="renewal_notice_days" inputMode="numeric" defaultValue={v("renewal_notice_days", String(terms.renewalNoticeDays))} />
        </Field>
      </div>
      <details className="rounded-[var(--radius-control)] border border-line px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-accent">Late charges, repairs and build-out</summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Rent late after day">
              <Input name="late_after_day" inputMode="numeric" defaultValue={v("late_after_day", String(terms.lateAfterDay))} />
            </Field>
            <Field label="Late charge (% of late amount)">
              <Input name="late_fee_percent" inputMode="decimal" defaultValue={v("late_fee_percent", String(terms.lateFeePercent))} />
            </Field>
            <Field label="Returned payment fee ($)">
              <Input name="returned_payment_fee" inputMode="decimal" defaultValue={v("returned_payment_fee", dollars(terms.returnedPaymentFeeCents))} />
            </Field>
            <Field label="Repair Threshold ($)" hint="Tenant pays each HVAC/plumbing/electrical repair up to this">
              <Input name="repair_threshold" inputMode="decimal" defaultValue={v("repair_threshold", dollars(terms.repairThresholdCents))} />
            </Field>
            <Field label="Systems warranty (days)" hint="Landlord fixes failures reported within this">
              <Input name="warranty_days" inputMode="numeric" defaultValue={v("warranty_days", String(terms.warrantyDays))} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Landlord's Work (Exhibit B-1)">
              <Textarea name="landlord_work" defaultValue={v("landlord_work", terms.landlordWork)} />
            </Field>
            <Field label="Tenant's Work (Exhibit B-2)">
              <Textarea name="tenant_work" defaultValue={v("tenant_work", terms.tenantWork)} />
            </Field>
          </div>
        </div>
      </details>
    </div>
  );
}

const empty: FormState = {};

export function CommercialTermsForm({ leaseId, terms, canEdit }: { leaseId: string; terms: CommercialTerms; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveCommercialTerms, empty);
  return (
    <form action={action}>
      <input type="hidden" name="lease_id" value={leaseId} />
      <fieldset disabled={!canEdit} className="space-y-4 p-5">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <CommercialTermsFields terms={terms} values={state.values} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save commercial terms"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
