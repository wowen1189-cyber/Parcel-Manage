"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { ManagementFee } from "@/lib/management-fees";
import { createOwner, deleteOwner, moveProperties, saveFee, updateOwner, type FormState } from "./actions";

const empty: FormState = {};

function Status({ state }: { state: FormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export const OWNER_TYPES = ["LLC", "Corporation", "Trust", "Partnership", "Individual"];

type OwnerValues = { id?: string; name: string; entity_type: string | null; email: string | null; phone: string | null; mailing_address: string | null; notes: string | null };

export function OwnerForm({ owner, canEdit }: { owner?: OwnerValues; canEdit: boolean }) {
  const [state, action, pending] = useActionState(owner?.id ? updateOwner : createOwner, empty);
  const v = (k: keyof OwnerValues) => state.values?.[k] ?? String(owner?.[k] ?? "");
  return (
    <form action={action}>
      {owner?.id && <input type="hidden" name="id" value={owner.id} />}
      <fieldset disabled={!canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Status state={state} />
        </div>
        <Field label="Owner name" hint="As it appears on the deed, e.g. 100 North Dewey St LLC">
          <Input name="name" required defaultValue={v("name")} />
        </Field>
        <Field label="Type">
          <Select name="entity_type" defaultValue={v("entity_type") || "LLC"}>
            {OWNER_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Email" hint="Where owner statements go">
          <Input name="email" type="email" defaultValue={v("email")} />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={v("phone")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Mailing address">
            <Input name="mailing_address" defaultValue={v("mailing_address")} placeholder="Street, city, state ZIP" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea name="notes" defaultValue={v("notes")} />
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : owner?.id ? "Save owner" : "Add owner"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

const dollars = (c: number) => (c ? String(c / 100) : "");

function Radio({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="size-[18px] accent-[var(--color-accent)]" />
      {children}
    </label>
  );
}

/**
 * Management fee terms. With `inheritLabel`, the first choice is to follow the level above
 * (a property follows its owner; an owner follows the company default).
 */
export function FeeForm({
  scope,
  targetId,
  fee,
  custom,
  inheritLabel,
  canEdit,
}: {
  scope: "company" | "owner" | "property";
  targetId?: string;
  fee: ManagementFee;
  custom: boolean;
  inheritLabel?: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveFee, empty);
  const sv = state.values;
  const [mode, setMode] = useState(sv?.mode ?? (inheritLabel && !custom ? "inherit" : "custom"));
  const [basis, setBasis] = useState(sv?.basis ?? fee.basis);
  const [leasing, setLeasing] = useState(sv?.leasingFee ?? fee.leasingFee);
  const [renewal, setRenewal] = useState(sv?.renewalFee ?? fee.renewalFee);
  const val = (k: string, d: string) => sv?.[k] ?? d;
  const showTerms = mode === "custom";
  return (
    <form action={action}>
      <input type="hidden" name="scope" value={scope} />
      {targetId && <input type="hidden" name="target_id" value={targetId} />}
      <fieldset disabled={!canEdit} className="space-y-4 p-5">
        <Status state={state} />
        {inheritLabel && (
          <div>
            <Radio name="mode" value="inherit" checked={mode === "inherit"} onChange={setMode}>
              {inheritLabel}
            </Radio>
            <Radio name="mode" value="custom" checked={mode === "custom"} onChange={setMode}>
              {scope === "property" ? "This property has its own fees (management, leasing and renewal)" : "This owner has its own agreement (management, leasing and renewal)"}
            </Radio>
          </div>
        )}
        {!inheritLabel && <input type="hidden" name="mode" value="custom" />}
        {showTerms && (
          <div className="grid gap-4 lg:grid-cols-3">
            <fieldset className="rounded-[var(--radius-control)] border border-line p-4">
              <legend className="px-1 text-sm font-bold">Monthly management fee</legend>
              <Radio name="basis" value="percent" checked={basis === "percent"} onChange={setBasis}>
                Percent of rent collected
              </Radio>
              <Radio name="basis" value="flat" checked={basis === "flat"} onChange={setBasis}>
                Flat amount per property
              </Radio>
              <Radio name="basis" value="per_unit" checked={basis === "per_unit"} onChange={setBasis}>
                Flat amount per occupied unit
              </Radio>
              <Radio name="basis" value="none" checked={basis === "none"} onChange={setBasis}>
                No monthly fee
              </Radio>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {basis === "percent" && (
                  <>
                    <Field label="Percent of rent">
                      <Input name="percent" inputMode="decimal" defaultValue={val("percent", String(fee.percent || ""))} placeholder="8" />
                    </Field>
                    <Field label="Monthly minimum ($)" hint="Optional">
                      <Input name="minimum" inputMode="decimal" defaultValue={val("minimum", dollars(fee.minimumCents))} placeholder="0" />
                    </Field>
                  </>
                )}
                {(basis === "flat" || basis === "per_unit") && (
                  <Field label={basis === "flat" ? "Amount a month ($)" : "Amount per unit a month ($)"}>
                    <Input name="flat" inputMode="decimal" defaultValue={val("flat", dollars(fee.flatCents))} />
                  </Field>
                )}
              </div>
              {basis !== "none" && (
                <label className="mt-2 flex min-h-10 items-center gap-3 text-sm">
                  <input type="checkbox" name="chargeWhenVacant" defaultChecked={sv ? sv.chargeWhenVacant === "on" : fee.chargeWhenVacant} className="size-[18px] accent-[var(--color-accent)]" />
                  {basis === "percent" ? "Charge the minimum even when no rent comes in" : "Charge it even when no rent comes in"}
                </label>
              )}
            </fieldset>
            <fieldset className="rounded-[var(--radius-control)] border border-line p-4">
              <legend className="px-1 text-sm font-bold">Leasing fee</legend>
              <p className="mb-1.5 text-[13px] text-subtle">Charged once when a new tenant signs a lease.</p>
              <Radio name="leasingFee" value="percent" checked={leasing === "percent"} onChange={setLeasing}>
                Percent of one month&apos;s rent
              </Radio>
              <Radio name="leasingFee" value="flat" checked={leasing === "flat"} onChange={setLeasing}>
                Flat amount
              </Radio>
              <Radio name="leasingFee" value="none" checked={leasing === "none"} onChange={setLeasing}>
                No leasing fee
              </Radio>
              <div className="mt-3">
                {leasing === "percent" && (
                  <Field label="Percent of a month">
                    <Input name="leasingPercent" inputMode="decimal" defaultValue={val("leasingPercent", String(fee.leasingPercent || ""))} placeholder="50" />
                  </Field>
                )}
                {leasing === "flat" && (
                  <Field label="Leasing fee ($)">
                    <Input name="leasingFlat" inputMode="decimal" defaultValue={val("leasingFlat", dollars(fee.leasingFlatCents))} />
                  </Field>
                )}
              </div>
            </fieldset>
            <fieldset className="rounded-[var(--radius-control)] border border-line p-4">
              <legend className="px-1 text-sm font-bold">Renewal fee</legend>
              <p className="mb-1.5 text-[13px] text-subtle">Charged once when a current tenant renews.</p>
              <Radio name="renewalFee" value="percent" checked={renewal === "percent"} onChange={setRenewal}>
                Percent of one month&apos;s rent
              </Radio>
              <Radio name="renewalFee" value="flat" checked={renewal === "flat"} onChange={setRenewal}>
                Flat amount
              </Radio>
              <Radio name="renewalFee" value="none" checked={renewal === "none"} onChange={setRenewal}>
                No renewal fee
              </Radio>
              <div className="mt-3">
                {renewal === "percent" && (
                  <Field label="Percent of a month">
                    <Input name="renewalPercent" inputMode="decimal" defaultValue={val("renewalPercent", String(fee.renewalPercent || ""))} placeholder="25" />
                  </Field>
                )}
                {renewal === "flat" && (
                  <Field label="Renewal fee ($)">
                    <Input name="renewal" inputMode="decimal" defaultValue={val("renewal", dollars(fee.renewalFeeCents))} placeholder="150" />
                  </Field>
                )}
              </div>
            </fieldset>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save fees"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function MovePropertiesForm({ ownerId, candidates }: { ownerId: string; candidates: { id: string; name: string; ownerName: string; unassigned: boolean }[] }) {
  const [state, action, pending] = useActionState(moveProperties, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entity_id" value={ownerId} />
      <Status state={state} />
      <div className="grid gap-1 sm:grid-cols-2">
        {candidates.map((p) => (
          <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 text-sm hover:bg-surface-muted">
            <input type="checkbox" name="property_id" value={p.id} className="size-[18px] accent-[var(--color-accent)]" />
            <span>
              <span className="font-semibold">{p.name}</span>
              <span className={`block text-[13px] ${p.unassigned ? "text-warn" : "text-subtle"}`}>{p.unassigned ? "Owner not set yet" : `Now under ${p.ownerName}`}</span>
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Moving…" : "Put checked properties under this owner"}
      </Button>
    </form>
  );
}

export function DeleteOwnerForm({ ownerId }: { ownerId: string }) {
  const [state, action, pending] = useActionState(deleteOwner, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={ownerId} />
      <Status state={state} />
      <Button type="submit" small variant="secondary" disabled={pending}>
        {pending ? "Deleting…" : "Delete this owner"}
      </Button>
    </form>
  );
}
