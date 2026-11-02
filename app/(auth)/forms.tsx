"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import {
  acceptInvitation,
  createCompany,
  sendSignInLink,
  setPassword,
  signInWithPassword,
  signUp,
  type FormState,
} from "./actions";

const empty: FormState = {};

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [reset, setReset] = useState(false);
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, empty);
  const [linkState, linkAction, linkPending] = useActionState(sendSignInLink, empty);
  const state = mode === "password" ? pwState : linkState;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-[var(--radius-control)] bg-line p-1" role="tablist" aria-label="How to sign in">
        {(["password", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setReset(false);
            }}
            className={`min-h-10 rounded-[9px] text-[13px] font-semibold ${mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            {m === "password" ? "Password" : "Email me a link"}
          </button>
        ))}
      </div>

      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}

      <form action={mode === "password" ? pwAction : linkAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
        </Field>
        {mode === "password" && (
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        )}
        {mode === "link" && reset && <input type="hidden" name="reset" value="1" />}
        <Button type="submit" className="w-full" disabled={pwPending || linkPending}>
          {mode === "password" ? (pwPending ? "Signing in…" : "Sign in") : linkPending ? "Sending…" : reset ? "Email me a reset link" : "Email me a sign-in link"}
        </Button>
      </form>
      {mode === "password" && (
        <p className="text-center text-[14px]">
          <button
            type="button"
            className="font-semibold text-accent hover:underline"
            onClick={() => {
              setMode("link");
              setReset(true);
            }}
          >
            Forgot your password?
          </button>
        </p>
      )}
    </div>
  );
}

export function SetPasswordForm({ next, email }: { next: string; email: string | null }) {
  const [state, action, pending] = useActionState(setPassword, empty);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {/* Lets the phone's password manager save the password under the right e-mail. */}
      {email && <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="New password" hint="At least 10 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
      </Field>
      <Field label="Type it again">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, empty);
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Your full name">
        <Input name="fullName" autoComplete="name" required defaultValue={state.fields?.fullName} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      </Field>
      <Field label="Password" hint="At least 10 characters.">
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

const TIME_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

export function CompanyForm({ rootDomain }: { rootDomain: string }) {
  const [state, action, pending] = useActionState(createCompany, empty);
  const [subdomain, setSubdomain] = useState(state.fields?.subdomain ?? "");
  return (
    <form action={action} className="space-y-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Company name">
        <Input name="name" required defaultValue={state.fields?.name} placeholder="Sunrise Property Management" />
      </Field>
      <Field label="Web address" hint={`Your team and tenants sign in at ${subdomain || "yourcompany"}.${rootDomain}`}>
        <div className="flex items-center gap-2">
          <Input
            name="subdomain"
            required
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="sunrisepm"
            aria-describedby="root-domain"
          />
          <span id="root-domain" className="shrink-0 text-muted">
            .{rootDomain}
          </span>
        </div>
      </Field>
      <Field label="Time zone">
        <Select name="timeZone" defaultValue="America/New_York">
          {TIME_ZONES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Setting up…" : "Create company"}
      </Button>
    </form>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, empty);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Accept invite"}
      </Button>
    </form>
  );
}
