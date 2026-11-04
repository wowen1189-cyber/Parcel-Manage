"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  { href: "/settings", label: "Company" },
  { href: "/settings/business-rules", label: "Business rules" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/payments", label: "Payments" },
  { href: "/settings/accounts", label: "Accounts" },
  { href: "/settings/texting", label: "Texting" },
  { href: "/settings/automations", label: "Automations" },
  { href: "/settings/ai", label: "AI" },
  { href: "/settings/api", label: "API" },
  { href: "/settings/team", label: "Team" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const strip = useRef<HTMLDivElement>(null);
  // On a phone the tabs are wider than the screen: they scroll sideways on their own (not the whole page),
  // with the current tab brought into view.
  useEffect(() => {
    strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <div ref={strip} className="-mx-4 mb-6 max-w-[100vw] overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <nav aria-label="Settings" className="inline-flex rounded-[var(--radius-control)] bg-line p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-[9px] px-4 text-[13px] font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
