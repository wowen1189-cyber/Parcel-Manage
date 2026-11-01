"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { NAV_ITEMS, NEW_MENU } from "@/lib/nav";

export function AppShell({
  companyName,
  userName,
  userTitle,
  signOutAction,
  children,
}: {
  companyName: string;
  userName: string;
  userTitle: string | null;
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The phone menu stays open only on the page where it was opened, so following a link closes it.
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = navOpenOn === pathname;
  const setNavOpen = (open: boolean) => setNavOpenOn(open ? pathname : null);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar: fixed on desktop, slide-over on phones */}
      <div
        className={`fixed inset-0 z-30 bg-ink/30 lg:hidden ${navOpen ? "block" : "hidden"}`}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Main"
      >
        <div className="border-b border-line px-4 py-4">
          <Logo companyName={companyName} />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const href = `/${item.slug}`;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium lg:min-h-9 ${active ? "bg-accent-softer font-semibold text-accent-deep" : "text-ink-2 hover:bg-surface-sunk"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-4 py-3">
          <p className="truncate text-[13px] font-semibold">{userName}</p>
          {userTitle && <p className="truncate text-[12px] text-subtle">{userTitle}</p>}
          <form action={signOutAction}>
            <button type="submit" className="mt-1 min-h-9 text-[13px] font-semibold text-accent hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className={`${buttonClass("secondary", true)} lg:hidden`}
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            Menu
          </button>
          <div className="flex-1" />
          <button type="button" className={buttonClass("secondary", true)} onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen}>
            Ask AI
          </button>
          <NewMenu />
        </header>

        <div className="flex min-w-0 flex-1">
          <main className="mx-auto w-full max-w-[1280px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
          {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={buttonClass("primary", true)} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        + New
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-[12px] border border-line bg-surface p-1.5 shadow-lg">
          {NEW_MENU.map((label) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              disabled
              title="Coming in Phase 1"
              className="flex min-h-10 w-full items-center justify-between rounded-[9px] px-3 text-left text-[14px] text-ink-2 disabled:cursor-not-allowed"
            >
              {label}
              <span className="text-[11px] text-subtle">Soon</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AiPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label="AI assistant"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-line bg-surface lg:sticky lg:top-[61px] lg:z-10 lg:h-[calc(100vh-61px)]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-bold">AI assistant</p>
        <button type="button" className={buttonClass("ghost", true)} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-muted">
        <p>Ask questions about your properties, tenants and books, and approve what the AI drafts.</p>
        <p>
          This needs your company&apos;s own AI key, which you&apos;ll connect in Settings in Phase 1. Until then, everything else
          works without AI.
        </p>
      </div>
    </aside>
  );
}
