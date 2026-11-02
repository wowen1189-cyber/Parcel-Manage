// Manager app navigation (docs/01-product-spec.md §2), grouped into dropdown menus.
// `phase` is when a screen gets built; unbuilt screens show a placeholder (app/(manager)/[section]).
// Each person can reorder groups and the items inside them (profile.preferences.nav).

export type NavItem = { slug: string; label: string; phase: number; description: string; href?: string };

export const NAV_ITEMS: NavItem[] = [
  { slug: "dashboard", label: "Dashboard", phase: 0, description: "Your key numbers and what needs attention." },
  { slug: "tasks", label: "To do", phase: 3, description: "Notices and decisions the daily automations found for you." },
  { slug: "properties", label: "Properties", phase: 0, description: "Buildings, units and who owns them." },
  { slug: "tenants", label: "Tenants & leases", phase: 1, description: "Tenant profiles, ledgers, leases and households." },
  { slug: "expirations", label: "Lease expirations", phase: 1, description: "Keep lease endings spread across the year.", href: "/tenants/expirations" },
  { slug: "lease-template", label: "Lease template", phase: 1, description: "The residential and commercial leases and Florida disclosures.", href: "/tenants/lease-template" },
  { slug: "leasing", label: "Leasing", phase: 3, description: "Vacancies, listings, guest cards and applicants." },
  { slug: "leasing-agent", label: "AI leasing agent", phase: 3, description: "Answers prospects 24/7, books showings and escalates to you." },
  { slug: "communications", label: "Communications", phase: 1, description: "Letters, notices, templates and the sent log." },
  { slug: "accounting", label: "Accounting", phase: 1, description: "General ledger, trial balance and owner statements." },
  { slug: "bills", label: "Bills", phase: 2, description: "Invoices read by AI, approved and paid." },
  { slug: "recurring-bills", label: "Recurring bills", phase: 2, description: "Bills that repeat on a schedule." },
  { slug: "journal-entries", label: "Journal entries", phase: 1, description: "Manual entries that must balance to post." },
  { slug: "bank-accounts", label: "Bank accounts", phase: 2, description: "Operating, trust and reserve accounts and reconciliation." },
  { slug: "reports", label: "Reports", phase: 4, description: "41 reports with exports and scheduled emails." },
  { slug: "metrics", label: "Metrics", phase: 4, description: "Targets, trends and alerts." },
  { slug: "maintenance", label: "Maintenance", phase: 1, description: "Work orders from request to completed invoice." },
  { slug: "inspections", label: "Inspections & deposits", phase: 2, description: "Move-in and move-out inspections and deposit returns." },
  { slug: "owners", label: "Owners", phase: 0, description: "Who owns each property, their management agreement and fees." },
  { slug: "management-agreements", label: "Management agreements", phase: 1, description: "Prepare each owner's agreement and send it for e-signature." },
  { slug: "e-sign", label: "E-sign", phase: 2, description: "Send anything for signature, with a full audit trail." },
  { slug: "settings", label: "Settings & team", phase: 0, description: "Company profile, business rules and your team." },
  { slug: "vendors", label: "Vendors", phase: 1, description: "Vendor directory with W-9 and insurance tracking." },
  { slug: "switch-over", label: "Switch-over checklist", phase: 4, description: "The steps to leave your old software safely." },
  { slug: "import", label: "Import data", phase: 1, description: "Bring in rent rolls, tenants, vendors and owners from AppFolio, Buildium, Rent Manager, Yardi or a spreadsheet." },
];

export type NavGroup = { id: string; label: string; items: string[] };

/** Default grouping. A group with one item shows as a plain link, not a dropdown. */
export const NAV_GROUPS: NavGroup[] = [
  { id: "home", label: "Dashboard", items: ["dashboard"] },
  { id: "leasing", label: "Leasing", items: ["tenants", "leasing", "expirations", "lease-template", "leasing-agent", "e-sign"] },
  { id: "portfolio", label: "Properties", items: ["properties", "owners", "management-agreements", "vendors"] },
  { id: "maintenance", label: "Maintenance", items: ["maintenance", "inspections"] },
  { id: "money", label: "Accounting", items: ["accounting", "bills", "recurring-bills", "journal-entries", "bank-accounts"] },
  { id: "insights", label: "Reports", items: ["reports", "metrics"] },
  { id: "communications", label: "Communications", items: ["communications", "tasks"] },
  { id: "admin", label: "Admin", items: ["settings", "import", "switch-over"] },
];

// "+ New" menu. Items without an href aren't built yet and show as "Soon".
export const NEW_MENU: { label: string; href?: string }[] = [
  { label: "Tenant and lease", href: "/tenants/new" },
  { label: "Property", href: "/properties/new" },
  { label: "Vendor", href: "/vendors/new" },
  { label: "Work order", href: "/maintenance/new" },
  { label: "Owner", href: "/owners/new" },
];

export function navItem(slug: string) {
  return NAV_ITEMS.find((item) => item.slug === slug);
}

export function navHref(item: NavItem) {
  return item.href ?? `/${item.slug}`;
}

/** Saved order: group ids, and item slugs per group. */
export type NavPrefs = { groups?: string[]; items?: Record<string, string[]> };

/**
 * The menu in the person's saved order. Anything saved that no longer exists is dropped; anything new
 * (added in a later release) keeps its default place at the end, so a saved order never hides a screen.
 */
export function orderedNav(prefs: NavPrefs | null | undefined): (NavGroup & { entries: NavItem[] })[] {
  const byId = new Map(NAV_GROUPS.map((g) => [g.id, g]));
  const groupOrder = [...(prefs?.groups ?? []).filter((id) => byId.has(id)), ...NAV_GROUPS.map((g) => g.id).filter((id) => !prefs?.groups?.includes(id))];
  return groupOrder.map((id) => {
    const g = byId.get(id)!;
    const saved = (prefs?.items?.[id] ?? []).filter((slug) => g.items.includes(slug));
    const slugs = [...saved, ...g.items.filter((slug) => !saved.includes(slug))];
    return { ...g, items: slugs, entries: slugs.map((slug) => navItem(slug)!).filter(Boolean) };
  });
}
