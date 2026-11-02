"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { addCalendar, makeFeedLink, type CalState } from "./actions";

export function FeedLink({ base, hasLink }: { base: string; hasLink: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = link ? `${base}/api/calendar/${link}.ics` : null;
  return (
    <div className="space-y-3">
      {url ? (
        <>
          <Notice tone="success">Your private link is ready. Copy it now: for your security it isn&apos;t shown again.</Notice>
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Your calendar link" />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={() => start(async () => setLink((await makeFeedLink()).link ?? null))} disabled={pending}>
          {pending ? "Making your link…" : hasLink ? "Make a new link (the old one stops working)" : "Make my calendar link"}
        </Button>
      )}
    </div>
  );
}

export function AddCalendarForm() {
  const [state, action, pending] = useActionState(addCalendar, {} as CalState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Field label="Name">
          <Input name="name" placeholder="Work" />
        </Field>
        <Field label="Secret address in iCal format">
          <Input name="url" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autoComplete="off" />
        </Field>
      </div>
      <Button type="submit" small disabled={pending}>
        {pending ? "Checking…" : "Add calendar"}
      </Button>
    </form>
  );
}
