"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { PROVIDERS, type Provider } from "@/lib/ai/models";
import { saveAiConnection, type AiState } from "./actions";

const empty: AiState = {};

export function AiForm({ current, canEdit }: { current: { provider: Provider; model: string; base_url: string | null; limit: number; keyHint: string | null } | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveAiConnection, empty);
  const [provider, setProvider] = useState<Provider>(current?.provider ?? "anthropic");
  const info = PROVIDERS[provider];
  return (
    <form action={action}>
      <fieldset disabled={!canEdit} className="space-y-4 p-5">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <Select name="provider" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
              {Object.entries(PROVIDERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model">
            {info.models.length ? (
              <Select name="model" defaultValue={current?.provider === provider ? current.model : info.models[0]} key={provider}>
                {info.models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            ) : (
              <Input name="model" defaultValue={current?.model ?? ""} placeholder="model name" />
            )}
          </Field>
          {provider === "openai_compatible" && (
            <Field label="Provider address (base URL)">
              <Input name="base_url" defaultValue={current?.base_url ?? ""} placeholder="https://api.example.com" />
            </Field>
          )}
          <Field label="API key" hint={current?.keyHint ? `Saved: ${current.keyHint}. Leave blank to keep it.` : `${info.keyHint}. Get one at ${info.keyUrl}.`}>
            <Input name="key" type="password" autoComplete="off" placeholder={current?.keyHint ? "••••••••" : "Paste the key"} />
          </Field>
          <Field label="Monthly spending limit ($)" hint="AI features pause for the rest of the month when reached.">
            <Input name="limit" inputMode="decimal" defaultValue={String((current?.limit ?? 10000) / 100)} />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving and testing…" : "Save and test"}
        </Button>
      </fieldset>
    </form>
  );
}
