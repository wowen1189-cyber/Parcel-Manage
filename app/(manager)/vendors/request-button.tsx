"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { requestPaperwork, requestPaperworkFromAll, type FormState } from "./actions";

const empty: FormState = {};

/** "Request paperwork" on a vendor page: e-mails the vendor their private upload link. */
export function RequestPaperworkButton({ vendorId, label, reminder }: { vendorId: string; label: string; reminder?: boolean }) {
  const [state, action, pending] = useActionState(requestPaperwork, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="vendor_id" value={vendorId} />
      {reminder && <input type="hidden" name="reminder" value="1" />}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Button type="submit" small disabled={pending}>
        {pending ? "Sending…" : label}
      </Button>
    </form>
  );
}

/** On the vendor list: request from every vendor missing paperwork. */
export function RequestAllButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState(requestPaperworkFromAll, empty);
  return (
    <form action={action} className="space-y-2">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Button type="submit" small variant="secondary" disabled={pending || !count}>
        {pending ? "Sending…" : `Request paperwork from ${count} vendor${count === 1 ? "" : "s"}`}
      </Button>
    </form>
  );
}
