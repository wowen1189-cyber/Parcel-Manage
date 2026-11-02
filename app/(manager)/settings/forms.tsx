"use client";

import { useActionState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { RULE_SECTIONS, type RuleField } from "@/lib/business-rules-form";
import {
  inviteTeammate,
  updateBusinessRules,
  updateCompanyProfile,
  updateMember,
  type SettingsState,
} from "./actions";

const empty: SettingsState = {};

function Status({ state }: { state: SettingsState }) {
  return (
    <>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
    </>
  );
}

type CompanyValues = {
  name: string;
  legal_name: string | null;
  office_phone: string | null;
  office_email: string | null;
  address: string | null;
  default_county: string | null;
  time_zone: string;
  broker_license: string | null;
};

const TIME_ZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

export function CompanyProfileForm({ company, canEdit, webAddress }: { company: CompanyValues; canEdit: boolean; webAddress: string }) {
  const [state, action, pending] = useActionState(updateCompanyProfile, empty);
  // After a failed save, show what was typed rather than the saved values.
  const v = (key: keyof CompanyValues) => (state.values?.[key] as string | undefined) ?? company[key] ?? "";
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Company profile" description="Shown to tenants, vendors and owners, and used on letters." />
        <fieldset disabled={!canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Status state={state} />
          </div>
          <Field label="Company name">
            <Input name="name" required defaultValue={v("name")} />
          </Field>
          <Field label="Legal name">
            <Input name="legal_name" defaultValue={v("legal_name")} />
          </Field>
          <Field label="Office phone shown to tenants">
            <Input name="office_phone" type="tel" defaultValue={v("office_phone")} />
          </Field>
          <Field label="Office email">
            <Input name="office_email" type="email" defaultValue={v("office_email")} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={v("address")} />
          </Field>
          <Field label="Default county" hint="Used on notices.">
            <Input name="default_county" defaultValue={v("default_county")} />
          </Field>
          <Field label="Florida broker license number" hint="Printed on management agreements.">
            <Input name="broker_license" defaultValue={v("broker_license")} placeholder="e.g. CQ1234567" />
          </Field>
          <Field label="Time zone">
            <Select name="time_zone" defaultValue={v("time_zone")}>
              {TIME_ZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="Web address" hint="Set when the company was created.">
            <Input value={webAddress} readOnly disabled />
          </Field>
        </fieldset>
        {canEdit && (
          <div className="flex justify-end border-t border-line px-5 py-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        )}
      </Card>
    </form>
  );
}

export function BusinessRulesForm({ values, canEdit }: { values: Record<string, string | boolean>; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateBusinessRules, empty);
  return (
    <form action={action} className="space-y-4">
      <Status state={state} />
      {RULE_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader title={section.title} description={section.description} />
          <fieldset disabled={!canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
            {section.fields.map((field) => (
              <RuleInput key={field.path} field={field} value={state.values?.[field.path] ?? values[field.path]} error={state.errors?.[field.path]} />
            ))}
          </fieldset>
        </Card>
      ))}
      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <Button type="submit" disabled={pending} className="shadow-lg">
            {pending ? "Saving…" : "Save business rules"}
          </Button>
        </div>
      )}
    </form>
  );
}

function RuleInput({ field, value, error }: { field: RuleField; value: string | boolean; error?: string }) {
  if (field.type === "boolean") {
    return (
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
        <input type="checkbox" name={field.path} defaultChecked={Boolean(value)} className="size-5 accent-[var(--color-accent)]" />
        <span className="font-medium">{field.label}</span>
      </label>
    );
  }
  if (field.type === "list") {
    return (
      <div className="sm:col-span-2">
        <Field label={field.label} hint={field.hint} error={error}>
          <Textarea name={field.path} defaultValue={String(value)} rows={6} />
        </Field>
      </div>
    );
  }
  const prefix = field.type === "money" ? "$" : null;
  const suffix = field.type === "percent" ? "%" : null;
  return (
    <Field label={field.label} hint={field.hint} error={error}>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-muted">{prefix}</span>}
        <Input
          name={field.path}
          defaultValue={String(value)}
          type={field.type === "time" ? "time" : "text"}
          inputMode={field.type === "text" || field.type === "time" ? undefined : "decimal"}
          aria-invalid={Boolean(error)}
        />
        {suffix && <span className="text-muted">{suffix}</span>}
      </div>
    </Field>
  );
}

const ROLE_OPTIONS = [
  ["admin", "Admin"],
  ["property_manager", "Property manager"],
  ["accountant", "Accountant"],
  ["maintenance_coordinator", "Maintenance coordinator"],
  ["leasing_agent", "Leasing agent"],
  ["read_only", "Read-only"],
] as const;

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteTeammate, empty);
  return (
    <form action={action} className="space-y-4 p-5">
      <Status state={state} />
      {state.inviteLink && <Input readOnly value={state.inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email">
          <Input name="email" type="email" required defaultValue={(state.values?.email as string) ?? ""} />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={(state.values?.role as string) ?? "property_manager"}>
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" hint="Shown on letters and emails.">
          <Input name="title" placeholder="Office Administrator" defaultValue={(state.values?.title as string) ?? ""} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}

export function MemberRow({
  member,
  canEdit,
}: {
  member: { id: string; name: string; email: string; role: string; title: string | null };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(updateMember, empty);
  return (
    <form action={action} className="grid items-end gap-3 px-5 py-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
      <input type="hidden" name="id" value={member.id} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{member.name}</p>
        <p className="truncate text-[13px] text-subtle">{member.email}</p>
        {state.error && <p className="mt-1 text-[13px] font-medium text-danger">{state.error}</p>}
        {state.message && <p className="mt-1 text-[13px] font-medium text-accent">{state.message}</p>}
      </div>
      <Field label="Role">
        <Select name="role" defaultValue={(state.values?.role as string) ?? member.role} disabled={!canEdit}>
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title">
        <Input name="title" defaultValue={(state.values?.title as string) ?? member.title ?? ""} disabled={!canEdit} />
      </Field>
      {canEdit && (
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}
