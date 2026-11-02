"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// A table row that highlights under the mouse and opens `href` when clicked anywhere on it. Keyboard and
// screen-reader users use the real link inside the row (its first cell); clicks on links or buttons inside
// the row do what they say instead of opening the row.
export function ClickRow({ href, selected, children }: { href: string; selected?: boolean; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
        router.push(href, { scroll: false });
      }}
      aria-selected={selected || undefined}
      className={`cursor-pointer transition-colors ${selected ? "bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-surface-sunk"}`}
    >
      {children}
    </tr>
  );
}

/** A filter form that refreshes as soon as a dropdown, date or field changes (no button needed). */
export function AutoSubmitForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <form
      action={action}
      className={className}
      onChange={(e) => {
        const form = e.currentTarget;
        const t = e.target as unknown as HTMLInputElement;
        // Typed amounts wait for the person to finish (blur or Enter); dropdowns and dates apply at once.
        if (t.type === "text" || t.inputMode === "decimal") return;
        const q = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
        router.replace(`${action}?${q}#planner`, { scroll: false });
      }}
    >
      {children}
    </form>
  );
}
