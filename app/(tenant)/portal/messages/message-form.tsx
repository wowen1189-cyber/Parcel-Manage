"use client";

import { useActionState } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { sendMessage, type PortalState } from "../actions";

const empty: PortalState = {};

export function MessageForm() {
  const [state, action, pending] = useActionState(sendMessage, empty);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Textarea name="body" aria-label="Message" placeholder="Write to the office…" defaultValue={state.values?.body} className="min-h-28" />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
