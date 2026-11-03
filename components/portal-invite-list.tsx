"use client";

import { useActionState, useState } from "react";
import { sendBulkInvites, type BulkInviteState } from "@/app/(manager)/portal-invites/actions";
import { Button, Notice, Pill } from "@/components/ui";

export type InviteRow = { key: string; name: string; detail: string; email: string; status: "using" | "invited" | "new" | "no-email"; invitedOn?: string };

const empty: BulkInviteState = {};

// A checklist of people to invite to a portal. Not-yet-invited people with an e-mail start checked;
// nothing is sent until Send is pressed.
export function PortalInviteList({ rows, noun, canSend }: { rows: InviteRow[]; noun: string; canSend: boolean }) {
  const [state, action, pending] = useActionState(sendBulkInvites, empty);
  const [checked, setChecked] = useState(() => new Set(rows.filter((r) => r.status === "new").map((r) => r.key)));
  const [confirming, setConfirming] = useState(false);
  const count = `${checked.size} ${noun} invite${checked.size === 1 ? "" : "s"}`;
  const sendable = rows.filter((r) => r.status !== "no-email");
  const toggle = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const pick = (which: "new" | "all" | "none") => setChecked(new Set(which === "none" ? [] : sendable.filter((r) => which === "all" || r.status === "new").map((r) => r.key)));

  return (
    <form action={(f) => (setConfirming(false), action(f))}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3 text-[13px]">
        <span className="font-semibold">{checked.size} checked</span>
        <span className="text-subtle">·</span>
        <button type="button" onClick={() => pick("new")} className="min-h-11 px-1 font-semibold text-accent hover:underline">
          Not invited yet
        </button>
        <button type="button" onClick={() => pick("all")} className="min-h-11 px-1 font-semibold text-accent hover:underline">
          Everyone with an e-mail
        </button>
        <button type="button" onClick={() => pick("none")} className="min-h-11 px-1 font-semibold text-accent hover:underline">
          None
        </button>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.key}>
            <label className={`flex items-start gap-3 px-5 py-3 text-[13px] ${r.status === "no-email" ? "opacity-70" : "cursor-pointer hover:bg-surface-muted"}`}>
              <input
                type="checkbox"
                name="invitee"
                value={r.key}
                checked={checked.has(r.key)}
                onChange={() => toggle(r.key)}
                disabled={r.status === "no-email" || !canSend}
                className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className="block text-subtle">{r.detail}</span>
                <span className="block break-words text-subtle">{r.email || "No e-mail on file"}</span>
              </span>
              <span className="shrink-0">
                {r.status === "using" && <Pill tone="success">Using the portal</Pill>}
                {r.status === "invited" && <Pill tone="info">Invited {r.invitedOn}</Pill>}
                {r.status === "new" && <Pill>Not invited</Pill>}
                {r.status === "no-email" && <Pill tone="warn">No e-mail</Pill>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line px-5 py-4">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        {!canSend ? (
          <p className="text-[13px] text-subtle">Your role can&apos;t send portal invites.</p>
        ) : pending ? (
          <Button type="button" disabled>
            Sending… keep this page open
          </Button>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold">E-mail {count} now? Each person can sign in right away.</span>
            <Button type="submit">Yes, send</Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={!checked.size} onClick={() => setConfirming(true)}>
            Send {count}
          </Button>
        )}
      </div>
    </form>
  );
}
