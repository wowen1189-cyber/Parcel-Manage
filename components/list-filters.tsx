import Link from "next/link";
import { buttonClass, Input, Select } from "@/components/ui";

export type FilterSelect = { name: string; label: string; options: [value: string, label: string][]; value?: string };

// Search box + filters for a list screen. A plain GET form, so filtered lists can be bookmarked and shared,
// and "Export CSV" downloads exactly what's on screen.
export function ListFilters({
  action,
  search,
  searchPlaceholder,
  selects = [],
  exportHref,
  count,
  noun,
}: {
  action: string;
  search?: string;
  searchPlaceholder: string;
  selects?: FilterSelect[];
  exportHref: string;
  count: number;
  noun: [singular: string, plural: string];
}) {
  const active = Boolean(search) || selects.some((s) => s.value);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4" role="search">
      <label className="min-w-[220px] flex-1">
        <span className="sr-only">Search</span>
        <Input type="search" name="q" defaultValue={search} placeholder={searchPlaceholder} />
      </label>
      {selects.map((s) => (
        <label key={s.name} className="min-w-[160px]">
          <span className="sr-only">{s.label}</span>
          <Select name={s.name} defaultValue={s.value ?? ""} aria-label={s.label}>
            <option value="">{s.label}: all</option>
            {s.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      ))}
      <button type="submit" className={buttonClass("secondary")}>
        Filter
      </button>
      {active && (
        <Link href={action} className={buttonClass("ghost")}>
          Clear
        </Link>
      )}
      <div className="ml-auto flex items-center gap-3">
        <p className="text-[13px] text-subtle" aria-live="polite">
          {count} {count === 1 ? noun[0] : noun[1]}
        </p>
        <a href={exportHref} className={buttonClass("secondary")} download>
          Export CSV
        </a>
      </div>
    </form>
  );
}

/** Reads a single string search param. */
export function param(params: Record<string, string | string[] | undefined>, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Same filters as the page, for the matching export link. */
export function exportLink(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return qs ? `${path}?${qs}` : path;
}
