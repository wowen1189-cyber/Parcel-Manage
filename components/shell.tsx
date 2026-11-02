"use client";

import Link from "next/link";
import { AiPanel } from "@/components/ai-panel";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { SidebarNav, type SidebarGroup } from "@/components/sidebar-nav";
import { NEW_MENU } from "@/lib/nav";

export function AppShell({
  companyName,
  userName,
  userTitle,
  signOutAction,
  navGroups,
  saveNav,
  children,
}: {
  companyName: string;
  userName: string;
  userTitle: string | null;
  signOutAction: () => Promise<void>;
  navGroups: SidebarGroup[];
  saveNav: Parameters<typeof SidebarNav>[0]["saveNav"];
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
        className={`fixed top-0 left-0 z-40 flex h-dvh w-[240px] flex-col border-r border-line bg-surface transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Main"
      >
        <div className="border-b border-line px-4 py-4">
          <Logo companyName={companyName} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={navGroups} saveNav={saveNav} />
        </div>
        <div className="border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="truncate text-[13px] font-semibold">{userName}</p>
          {userTitle && <p className="truncate text-[12px] text-subtle">{userTitle}</p>}
          <div className="mt-1 flex gap-4">
            <form action={signOutAction}>
              <button type="submit" className="min-h-9 text-[13px] font-semibold text-accent hover:underline">
                Sign out
              </button>
            </form>
            <Link href="/set-password?next=/dashboard" className="inline-flex min-h-9 items-center text-[13px] font-semibold text-muted hover:underline">
              Change password
            </Link>
          </div>
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
          {NEW_MENU.map(({ label, href }) =>
            href ? (
              <Link
                key={label}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-10 w-full items-center rounded-[9px] px-3 text-left text-[14px] font-medium text-ink hover:bg-surface-sunk"
              >
                {label}
              </Link>
            ) : (
              <button
                key={label}
                type="button"
                role="menuitem"
                disabled
                title="Coming soon"
                className="flex min-h-10 w-full items-center justify-between rounded-[9px] px-3 text-left text-[14px] text-subtle disabled:cursor-not-allowed"
              >
                {label}
                <span className="text-[11px]">Soon</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
