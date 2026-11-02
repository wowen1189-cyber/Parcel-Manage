import "server-only";
import { date, todayIn } from "@/lib/format";
import { readFilters } from "@/lib/report-filters";
import { reportById } from "@/lib/reports";
import { requireCompany } from "@/lib/session";

/** Run a report for an export route: the same filters and data as the page. Null when it doesn't exist. */
export async function runReportFromUrl(id: string, url: string) {
  const r = reportById(id);
  if (!r?.run) return null;
  const { supabase, company } = await requireCompany();
  const sp = Object.fromEntries(new URL(url).searchParams);
  const f = readFilters(sp, todayIn(company.time_zone), r.forward);
  const result = await r.run(supabase, company.id, f);
  const [{ data: owner }, { data: property }] = await Promise.all([
    f.owner && r.filters.includes("owner") ? supabase.from("entity").select("name").eq("id", f.owner).maybeSingle() : Promise.resolve({ data: null }),
    f.property && r.filters.includes("property") ? supabase.from("property").select("name").eq("id", f.property).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const parts = [
    r.filters.includes("range") ? `${date(f.from)} to ${date(f.to)}` : null,
    r.filters.includes("asOf") ? `As of ${date(f.asOf)}` : null,
    r.filters.includes("owner") ? (owner?.name ?? "All owners") : null,
    r.filters.includes("property") ? (property?.name ?? "All properties") : null,
  ].filter(Boolean);
  return { report: r, company, f, result, filtersLine: parts.join(" · ") || `Run ${date(todayIn(company.time_zone))}` };
}
