"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { decline, sign, type SignState } from "./actions";

const empty: SignState = {};

export function SignForm({ token, name, consentText }: { token: string; name: string; consentText: string }) {
  const [state, action, pending] = useActionState(sign, empty);
  const [d, declineAction, declining] = useActionState(decline, empty);
  const [showDecline, setShowDecline] = useState(false);
  if (state.done || d.done)
    return (
      <Notice tone="success">
        {d.done ? "You declined to sign. The office has been notified." : "Signed. Thank you! When everyone has signed, you'll get an e-mail with the signed copy."}
      </Notice>
    );
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" name="consent" className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]" />
          <span>{consentText}</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Type your full name to sign" hint={`Exactly as on the lease: ${name}`}>
            <Input name="typed" autoComplete="name" className="font-serif text-[18px] italic" />
          </Field>
          <Field label="Your initials" hint="Applied to every initials line">
            <Input name="initials" maxLength={6} className="font-serif text-[18px] italic" />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing…" : "Sign"}
        </Button>
      </form>
      {!showDecline ? (
        <button type="button" onClick={() => setShowDecline(true)} className="text-[13px] font-semibold text-subtle underline">
          I don&apos;t want to sign
        </button>
      ) : (
        <form action={declineAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" small variant="secondary" disabled={declining}>
            {declining ? "Saving…" : "Decline to sign"}
          </Button>
        </form>
      )}
    </div>
  );
}
