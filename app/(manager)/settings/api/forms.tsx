"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { API_SCOPES } from "@/lib/api/scopes";
import { createApiKey, type KeyState } from "./actions";

export function NewKeyForm() {
  const [state, action, pending] = useActionState(createApiKey, {} as KeyState);
  const [copied, setCopied] = useState(false);
  if (state.key) {
    return (
      <div className="space-y-3 p-5">
        <Notice tone="warn">Copy this key now. It won&apos;t be shown again; if it&apos;s lost, revoke it and make a new one.</Notice>
        <p className="text-sm font-semibold">{state.name}</p>
        <code className="block break-all rounded-[var(--radius-control)] border border-line bg-surface-muted p-3 text-[13px]">{state.key}</code>
        <Button
          type="button"
          small
          onClick={async () => {
            await navigator.clipboard.writeText(state.key!);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Name" hint="What will use it">
        <Input name="name" placeholder="Zapier" maxLength={80} required />
      </Field>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-[13px] font-semibold text-ink-2">It may</legend>
        {Object.entries(API_SCOPES).map(([k, label]) => (
          <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name={`scope_${k}`} defaultChecked={k === "read"} className="size-[18px] accent-[var(--color-accent)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Making…" : "Make key"}
      </Button>
    </form>
  );
}
