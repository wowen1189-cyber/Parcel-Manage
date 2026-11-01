"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { Section } from "@/lib/application-form";
import { applyToListing, inquire, submitInvited, type ApplyState } from "./actions";

const empty: ApplyState = {};

/** The rental application: the unit's question set, other adults to invite, authorization, then fees. */
export function ApplicationForm({
  mode,
  hidden,
  sections,
  defaults,
  inviteOthers,
  feeText,
  authorization,
}: {
  mode: "listing" | "invited";
  hidden: Record<string, string>;
  sections: Section[];
  defaults: Record<string, string>;
  inviteOthers: boolean;
  feeText: string;
  authorization: string;
}) {
  const [state, action, pending] = useActionState(mode === "listing" ? applyToListing : submitInvited, empty);
  const [others, setOthers] = useState(0);
  return (
    <form action={action} className="space-y-8">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {sections.map((s) => (
        <section key={s.title} className="space-y-3">
          <h2 className="text-[19px] font-bold">{s.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.questions.map((q) => (
              <div key={q.name} className={q.type === "textarea" ? "sm:col-span-2" : undefined}>
                <Field label={`${q.label}${q.required ? "" : " (optional)"}`} hint={q.hint}>
                  {q.type === "textarea" ? (
                    <Textarea name={q.name} rows={3} defaultValue={defaults[q.name]} />
                  ) : q.type === "select" ? (
                    <Select name={q.name} defaultValue={defaults[q.name] ?? ""}>
                      <option value="">Choose…</option>
                      {q.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      name={q.name}
                      type={q.type === "money" || q.type === "number" ? "text" : q.type}
                      inputMode={q.type === "money" ? "decimal" : q.type === "number" ? "numeric" : undefined}
                      autoComplete={q.name === "first_name" ? "given-name" : q.name === "last_name" ? "family-name" : q.type === "email" ? "email" : q.type === "tel" && q.name === "phone" ? "tel" : undefined}
                      defaultValue={defaults[q.name]}
                    />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </section>
      ))}
      {inviteOthers && (
        <section className="space-y-3">
          <h2 className="text-[19px] font-bold">Other adults moving in</h2>
          <p className="text-[14px] text-muted">Everyone 18 or older fills out their own application. We&apos;ll e-mail each of them a link.</p>
          {Array.from({ length: others }).map((_, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-3">
              <Field label="First name">
                <Input name={`co_${i}_first`} />
              </Field>
              <Field label="Last name">
                <Input name={`co_${i}_last`} />
              </Field>
              <Field label="E-mail">
                <Input name={`co_${i}_email`} type="email" />
              </Field>
            </div>
          ))}
          {others < 4 && (
            <Button type="button" small variant="secondary" onClick={() => setOthers(others + 1)}>
              + Add another adult
            </Button>
          )}
        </section>
      )}
      <section className="space-y-3">
        <p className="rounded-[var(--radius-card)] bg-surface-muted px-4 py-3 text-[14px]">{feeText}</p>
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" name="authorize" className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]" />
          <span>{authorization}</span>
        </label>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Sending…" : "Submit application"}
        </Button>
      </section>
    </form>
  );
}

export function InquiryForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(inquire, empty);
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">
          <Input name="first_name" autoComplete="given-name" />
        </Field>
        <Field label="Last name">
          <Input name="last_name" autoComplete="family-name" />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="Phone">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="When do you want to move in?">
          <Input name="desired_move_in" type="date" />
        </Field>
      </div>
      <Field label="Question or message (optional)">
        <Textarea name="notes" rows={3} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
