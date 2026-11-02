"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { answerRenewalOffer, type AnswerState } from "./actions";

// The tenant picks one option (a big button each), or says they won't renew. Confirmed before it's sent.
export function RenewalAnswer({ offerId, options }: { offerId: string; options: { title: string; detail: string }[] }) {
  const [picked, setPicked] = useState<number | "decline" | null>(null);
  const [state, setState] = useState<AnswerState>({});
  const [pending, start] = useTransition();
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <div className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setPicked(i)}
          aria-pressed={picked === i}
          className={`block w-full rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors ${picked === i ? "border-accent bg-accent-softer" : "border-line-strong bg-surface hover:bg-surface-sunk"}`}
        >
          <span className="block text-[16px] font-bold">{o.title}</span>
          <span className="block text-[14px] text-muted">{o.detail}</span>
        </button>
      ))}
      <button type="button" onClick={() => setPicked("decline")} aria-pressed={picked === "decline"} className={`min-h-11 text-[14px] font-semibold ${picked === "decline" ? "text-danger" : "text-muted"} hover:underline`}>
        I don&apos;t plan to renew
      </button>
      {picked !== null && (
        <div className="rounded-[var(--radius-control)] bg-surface-muted px-4 py-3">
          <p className="text-[14px]">{picked === "decline" ? "Tell the office you won't renew?" : `Choose option ${picked + 1}: ${options[picked].title}?`}</p>
          <Button className="mt-2" variant={picked === "decline" ? "secondary" : "primary"} disabled={pending} onClick={() => start(async () => setState(await answerRenewalOffer(offerId, picked)))}>
            {pending ? "Sending…" : picked === "decline" ? "Yes, I won't renew" : "Yes, choose this option"}
          </Button>
        </div>
      )}
    </div>
  );
}
