"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { SortableList, SortHandle } from "@/components/sortable";
import { NAV_GROUPS } from "@/lib/nav";

export type SidebarGroup = { id: string; label: string; entries: { slug: string; label: string; href: string }[] };
type SaveNav = (value: { groups: string[]; items: Record<string, string[]> } | null) => Promise<{ ok?: boolean; error?: string }>;

// The main menu: groups open like dropdowns; the group holding the current page starts open.
// "Customize menu" lets each person drag groups and items into their own order (saved on their profile).
export function SidebarNav({ groups, saveNav }: { groups: SidebarGroup[]; saveNav: SaveNav }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // The most specific match wins, so /tenants/expirations highlights "Lease expirations", not "Tenants & leases".
  const activeHref = groups
    .flatMap((g) => g.entries.map((e) => e.href))
    .filter(isActive)
    .sort((a, b) => b.length - a.length)[0];
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<SidebarGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const persist = (value: Parameters<SaveNav>[0]) =>
    startTransition(async () => {
      const res = await saveNav(value);
      if (res.error) setError(res.error);
      else {
        setEditing(null);
        setError(null);
      }
    });

  if (editing) {
    return (
      <div className="px-2 py-3">
        <p className="px-2 pb-2 text-[12px] text-subtle">Drag, or use the arrows, to put groups and items in your order.</p>
        <SortableList
          items={editing}
          getKey={(g) => g.id}
          onChange={setEditing}
          className="space-y-2"
          render={(g, controls) => (
            <div className="rounded-[10px] border border-line bg-surface-muted">
              <div className="flex items-center justify-between gap-1 px-2 py-1">
                <span className="truncate text-[13px] font-bold">{g.label}</span>
                <SortHandle label={g.label} controls={controls} />
              </div>
              {g.entries.length > 1 && (
                <SortableList
                  items={g.entries}
                  getKey={(e) => e.slug}
                  onChange={(entries) => setEditing(editing.map((x) => (x.id === g.id ? { ...x, entries } : x)))}
                  className="space-y-0.5 px-1 pb-1"
                  render={(e, c) => (
                    <div className="flex items-center justify-between gap-1 rounded-[8px] bg-surface px-2 py-0.5">
                      <span className="truncate text-[13px]">{e.label}</span>
                      <SortHandle label={e.label} controls={c} />
                    </div>
                  )}
                />
              )}
            </div>
          )}
        />
        {error && <p className="mt-2 px-2 text-[12px] font-medium text-danger">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2 px-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => persist({ groups: editing.map((g) => g.id), items: Object.fromEntries(editing.map((g) => [g.id, g.entries.map((e) => e.slug)])) })}
            className="min-h-9 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(null)} className="min-h-9 rounded-[10px] px-3 text-[13px] font-semibold hover:bg-surface-sunk">
            Cancel
          </button>
          <button type="button" disabled={pending} onClick={() => persist(null)} className="min-h-9 rounded-[10px] px-3 text-[13px] font-semibold text-muted hover:bg-surface-sunk" title={`Back to: ${NAV_GROUPS.map((g) => g.label).join(", ")}`}>
            Reset
          </button>
        </div>
      </div>
    );
  }

  return (
    <nav className="px-2 py-3" aria-label="Main menu">
      <ul className="space-y-0.5">
        {groups.map((g) => {
          if (g.entries.length === 1) {
            const e = g.entries[0];
            return (
              <li key={g.id}>
                <NavLink href={e.href} label={e.label} active={e.href === activeHref} />
              </li>
            );
          }
          const hasActive = g.entries.some((e) => e.href === activeHref);
          const isOpen = open[g.id] ?? hasActive;
          return (
            <li key={g.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen({ ...open, [g.id]: !isOpen })}
                className={`flex min-h-11 w-full items-center justify-between rounded-[10px] px-3 text-left text-[14px] lg:min-h-9 ${hasActive ? "font-semibold text-accent-deep" : "font-medium text-ink-2"} hover:bg-surface-sunk`}
              >
                {g.label}
                <span aria-hidden className={`text-[11px] text-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {isOpen && (
                <ul className="mb-1 ml-3 space-y-0.5 border-l border-line pl-2">
                  {g.entries.map((e) => (
                    <li key={e.slug}>
                      <NavLink href={e.href} label={e.label} active={e.href === activeHref} small />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => setEditing(groups)} className="mt-3 min-h-9 px-3 text-[12px] font-semibold text-subtle hover:text-accent">
        Customize menu
      </button>
    </nav>
  );
}

function NavLink({ href, label, active, small }: { href: string; label: string; active: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-[10px] px-3 lg:min-h-9 ${small ? "text-[13.5px]" : "text-[14px]"} ${active ? "bg-accent-softer font-semibold text-accent-deep" : "font-medium text-ink-2 hover:bg-surface-sunk"}`}
    >
      {label}
    </Link>
  );
}
