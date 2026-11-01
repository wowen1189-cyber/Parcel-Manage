// Manager app navigation (docs/01-product-spec.md §2). `phase` is when the screen gets built.
export type NavItem = { slug: string; label: string; phase: number; description: string };

export const NAV_ITEMS: NavItem[] = [
  { slug: "dashboard", label: "Dashboard", phase: 0, description: "Your key numbers and what needs attention." },
  { slug: "properties", label: "Properties", phase: 0, description: "Buildings, units and who owns them." },
  { slug: "tenants", label: "Tenants & leases", phase: 1, description: "Tenant profiles, ledgers, leases and households." },
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
  { slug: "owners", label: "Owners & payouts", phase: 2, description: "Owner records, statements and distributions." },
  { slug: "e-sign", label: "E-sign", phase: 2, description: "Send anything for signature, with a full audit trail." },
  { slug: "settings", label: "Settings & team", phase: 0, description: "Company profile, business rules and your team." },
  { slug: "vendors", label: "Vendors", phase: 1, description: "Vendor directory with W-9 and insurance tracking." },
  { slug: "import", label: "Import data", phase: 1, description: "Bring in rent rolls, tenants, vendors and AppFolio exports." },
];

export const NEW_MENU = ["Property", "Tenant and lease", "Owner", "Work order", "Vendor"] as const;

export function navItem(slug: string) {
  return NAV_ITEMS.find((item) => item.slug === slug);
}
