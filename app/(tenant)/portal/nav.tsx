"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal", label: "Home" },
  { href: "/portal/maintenance", label: "Repairs" },
  { href: "/portal/payments", label: "Payments" },
  { href: "/portal/lease", label: "My lease" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/messages", label: "Messages" },
];

export function PortalNav() {
  const path = usePathname();
  return (
    <nav aria-label="Portal" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1">
        {TABS.map((t) => {
          const active = t.href === "/portal" ? path === "/portal" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-control)] px-3.5 text-[14px] font-semibold ${active ? "bg-accent-softer text-accent-deep" : "text-muted hover:bg-surface-muted"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
