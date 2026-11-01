// Display helpers shared by screens and CSV exports.

export function money(cents: number | null | undefined, { blank = "—" } = {}): string {
  if (cents == null) return blank;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-05-01" → "May 1, 2026". Dates are calendar dates, so no time zone shift. */
export function date(iso: string | null | undefined, { blank = "—" } = {}): string {
  if (!iso) return blank;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "2026-05-01" → "05/01/2026" for spreadsheets. */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

export type NamedContact = { kind?: string | null; first_name: string | null; last_name: string | null; business_name: string | null };

export function contactName(c: NamedContact | null | undefined): string {
  if (!c) return "";
  if (c.business_name) return c.business_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

/** Sort key: last name first for people, business name for companies. */
export function contactSortKey(c: NamedContact): string {
  return (c.business_name ?? `${c.last_name ?? ""} ${c.first_name ?? ""}`).toLowerCase().trim();
}

export function oneLineAddress(a: { address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null }): string {
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.address_line1, a.address_line2, cityLine].filter(Boolean).join(", ");
}

export const PROPERTY_TYPE_LABEL: Record<string, string> = {
  single_family: "Single-family",
  multi_family: "Multi-family",
  commercial: "Commercial",
  mixed_use: "Mixed-use",
};

export const UNIT_STATUS: Record<string, { label: string; tone: "success" | "warn" | "danger" | "info" | "neutral" }> = {
  occupied: { label: "Occupied", tone: "success" },
  notice: { label: "On notice", tone: "warn" },
  vacant: { label: "Vacant", tone: "danger" },
  listed: { label: "Listed", tone: "info" },
  down: { label: "Down", tone: "neutral" },
};

export function bedBath(beds: number | null, baths: number | null): string {
  if (beds == null && baths == null) return "—";
  return `${beds ?? "–"} bd / ${baths != null ? Number(baths) : "–"} ba`;
}

/** Whole days from `fromIso` to `toIso` (negative if `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Today's date in the company's time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
