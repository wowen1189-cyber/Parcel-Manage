"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { sendForSignature, type EsignState } from "../../esign-actions";

const empty: EsignState = {};

export function SendForSignature({ leaseId }: { leaseId: string }) {
  const [state, action, pending] = useActionState(sendForSignature, empty);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="lease_id" value={leaseId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      {!state.message && (
        <Button type="submit" small disabled={pending}>
          {pending ? "Sending…" : "Send for e-signature"}
        </Button>
      )}
    </form>
  );
}
