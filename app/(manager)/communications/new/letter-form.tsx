"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { letterById, type LetterContext } from "@/lib/letters";
import { sendLetter, type LetterState } from "../actions";

const empty: LetterState = {};

export function LetterForm({
  templateId,
  leaseId,
  ctx,
  defaultTitle,
  emailNotices,
  hasEmail,
}: {
  templateId: string;
  leaseId: string;
  ctx: LetterContext;
  defaultTitle: string;
  emailNotices: boolean;
  hasEmail: boolean;
}) {
  const template = letterById(templateId)!;
  const [state, action, pending] = useActionState(sendLetter, empty);
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.inputs.map((i) => [i.id, state.values?.[`in_${i.id}`] ?? (i.id === "amount" && templateId === "three-day" ? (ctx.rentOwedCents / 100).toFixed(2) : i.kind === "date" ? ctx.today : "")])),
  );
  const [title, setTitle] = useState(state.values?.sender_title ?? defaultTitle);
  const legalEmailOk = !template.legal || emailNotices;
  const [delivery, setDelivery] = useState(state.values?.delivery ?? (template.legal ? (emailNotices && hasEmail ? "email" : "posted") : hasEmail ? "email" : "print"));
  const preview = template.body({ ...ctx, senderTitle: title }, inputs);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <input type="hidden" name="lease_id" value={leaseId} />
      <input type="hidden" name="template_id" value={templateId} />
      <div className="space-y-6">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {template.inputs.length > 0 && (
          <Card>
            <CardHeader title="Fill in" />
            <div className="space-y-4 p-5">
              {template.inputs.map((i) => (
                <Field key={i.id} label={i.label} hint={i.hint}>
                  {i.kind === "longtext" ? (
                    <Textarea name={`in_${i.id}`} value={inputs[i.id]} onChange={(e) => setInputs({ ...inputs, [i.id]: e.target.value })} />
                  ) : (
                    <Input name={`in_${i.id}`} type={i.kind === "date" ? "date" : "text"} inputMode={i.kind === "money" ? "decimal" : undefined} value={inputs[i.id]} onChange={(e) => setInputs({ ...inputs, [i.id]: e.target.value })} />
                  )}
                </Field>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="From and delivery" />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Signed by">
                <Input value={ctx.senderName} disabled />
              </Field>
              <Field label="Your title on this letter">
                <Input name="sender_title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <Field label="How it's delivered" hint={template.legal ? "Florida law (83.56(4)): mail, hand delivery, posting if the tenant is absent, or e-mail only under the signed e-mail addendum." : undefined}>
              <Select name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                {hasEmail && legalEmailOk && <option value="email">E-mail{template.legal ? " (tenant signed the e-mail addendum)" : ""}</option>}
                {!template.legal && <option value="portal">Tenant portal message</option>}
                {template.legal ? (
                  <>
                    <option value="posted">Print, then post on the door (tenant absent)</option>
                    <option value="hand_delivered">Print, then hand to the tenant</option>
                    <option value="mail">Print and mail</option>
                    <option value="certified_mail">Print and send certified mail</option>
                  </>
                ) : (
                  <option value="print">Print</option>
                )}
              </Select>
            </Field>
            {template.legal && !emailNotices && <Notice tone="warn">This tenant hasn&apos;t signed the e-mail notice addendum, so this notice must be printed and delivered by hand, posting or mail.</Notice>}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : delivery === "email" ? "Send e-mail" : delivery === "portal" ? "Send to portal" : "Save and print"}
            </Button>
            <p className="text-[13px] text-subtle">A copy is filed on the tenant&apos;s record and logged under Sent.</p>
          </div>
        </Card>
      </div>
      <Card className="h-fit p-6">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-subtle">Preview</p>
        <h2 className="mt-2 text-[18px] font-bold">{template.subject(ctx, inputs)}</h2>
        {template.cite && <p className="text-[12px] text-subtle">{template.cite}</p>}
        <div className="mt-4 space-y-3 font-serif text-[15px] leading-relaxed">
          {preview.map((x, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {x}
            </p>
          ))}
        </div>
      </Card>
    </form>
  );
}
