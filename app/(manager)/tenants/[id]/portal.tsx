"use client";

import { useActionState, useState } from "react";
import { Button, Notice, Select, Textarea } from "@/components/ui";
import { MAX_TEXT } from "@/lib/sms";
import { practiceReply, replyToTenant, sendPortalInvite, textTenant, type PortalStaffState } from "../portal-actions";

const empty: PortalStaffState = {};

export function InviteButton({ contactId, label }: { contactId: string; label: string }) {
  const [state, action, pending] = useActionState(sendPortalInvite, empty);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="contact_id" value={contactId} />
      {state.error && <span className="mr-2 text-[12px] text-danger">{state.error}</span>}
      {state.message ? (
        <span className="text-[12px] text-accent">{state.message}</span>
      ) : (
        <Button type="submit" small variant="secondary" disabled={pending}>
          {pending ? "Sending…" : label}
        </Button>
      )}
    </form>
  );
}

export function ReplyForm({ contactId, leaseId }: { contactId: string; leaseId: string }) {
  const [state, action, pending] = useActionState(replyToTenant, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="lease_id" value={leaseId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Textarea name="body" aria-label="Reply" placeholder="Reply (goes to their portal and e-mail, signed with your name and title)" className="min-h-20" />
      <Button type="submit" small disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}

type Person = { id: string; name: string; mobile: string };

/** A text to one tenant who agreed to texts. Practice mode saves it without sending. */
export function TextForm({ people, leaseId, practice }: { people: Person[]; leaseId: string; practice: boolean }) {
  const [state, action, pending] = useActionState(textTenant, empty);
  const [body, setBody] = useState("");
  return (
    <form action={(f) => { action(f); setBody(""); }} className="space-y-2 border-t border-line pt-3">
      <input type="hidden" name="lease_id" value={leaseId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold">Text</span>
        {people.length === 1 ? (
          <>
            <input type="hidden" name="contact_id" value={people[0].id} />
            <span>{people[0].name} · {people[0].mobile}</span>
          </>
        ) : (
          <Select name="contact_id" aria-label="Who to text" className="w-auto">
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.mobile}
              </option>
            ))}
          </Select>
        )}
      </div>
      <Textarea name="body" aria-label="Text message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_TEXT} placeholder="Text message (starts with your company name)" className="min-h-16" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" small disabled={pending || body.trim().length < 2}>
          {pending ? "Sending…" : practice ? "Save practice text" : "Send text"}
        </Button>
        <span className="text-[12px] text-subtle">{body.length}/{MAX_TEXT}</span>
      </div>
    </form>
  );
}

/** Practice mode: pretend a tenant texted back (try a reply, STOP or START). */
export function PracticeReplyForm({ people, leaseId }: { people: { id: string; name: string }[]; leaseId: string }) {
  const [state, action, pending] = useActionState(practiceReply, empty);
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer font-semibold text-accent">Practice: pretend they texted back</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="lease_id" value={leaseId} />
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <Select name="contact_id" aria-label="Who texted" className="w-auto">
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Textarea name="body" aria-label="What they texted" placeholder="What they texted, e.g. Thanks! or STOP" className="min-h-14" />
        <Button type="submit" small variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save practice reply"}
        </Button>
      </form>
    </details>
  );
}
