import type { Filters } from "@/lib/reports";

const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const id = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : "");

/** Report filters from the address bar. Defaults: this year to date (or the next 12 months), as of today. */
export function readFilters(sp: Record<string, string | string[] | undefined>, today: string, forward = false): Filters {
  const yearOut = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  return { from: day(sp.from) ?? (forward ? today : `${today.slice(0, 4)}-01-01`), to: day(sp.to) ?? (forward ? yearOut : today), asOf: day(sp.as_of) ?? today, owner: id(sp.owner), property: id(sp.property) };
}
