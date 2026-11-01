"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "Company" },
  { href: "/settings/business-rules", label: "Business rules" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/team", label: "Team" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="mb-6 inline-flex rounded-[var(--radius-control)] bg-line p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-[9px] px-4 text-[13px] font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
