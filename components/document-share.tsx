"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { setDocumentSharing } from "@/app/(manager)/documents/actions";

// Two switches on each office document row: can the tenant see it, can the owner see it.
export function DocumentShare({ id, tenant, owner, showTenant = true }: { id: string; tenant: boolean; owner: boolean; showTenant?: boolean }) {
  const path = usePathname();
  const [state, setState] = useState({ tenant, owner });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const flip = (who: "tenant" | "owner") =>
    start(async () => {
      const next = !state[who];
      setState((s) => ({ ...s, [who]: next }));
      const r = await setDocumentSharing({ id, who, shared: next, path });
      if (r.error) {
        setState((s) => ({ ...s, [who]: !next }));
        setError(r.error);
      } else setError("");
    });
  const pill = (who: "tenant" | "owner", label: string) => (
    <button
      type="button"
      onClick={() => flip(who)}
      disabled={pending}
      aria-pressed={state[who]}
      title={state[who] ? `Shared with the ${who}. Click to make it office only.` : `Office only. Click to share with the ${who}.`}
      className={`min-h-8 rounded-full border px-2.5 text-[12px] font-semibold ${state[who] ? "border-accent bg-accent-softer text-accent-deep" : "border-line-strong text-subtle hover:bg-surface-muted"}`}
    >
      {state[who] ? "✓ " : ""}
      {label}
    </button>
  );
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {showTenant && pill("tenant", "Tenant")}
      {pill("owner", "Owner")}
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </span>
  );
}
