"use client";

import { useActionState } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { replyToTenant, sendPortalInvite, type PortalStaffState } from "../portal-actions";

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
