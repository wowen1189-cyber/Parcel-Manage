import { NextResponse } from "next/server";
import { todayIn } from "@/lib/format";
import { readFilters } from "@/lib/report-filters";
import { toCsv } from "@/lib/report-math";
import { reportById } from "@/lib/reports";
import { requireCompany } from "@/lib/session";

export async function GET(request: Request, ctx: RouteContext<"/reports/[id]/csv">) {
  const { id } = await ctx.params;
  const r = reportById(id);
  if (!r?.run) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const { supabase, company } = await requireCompany();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const f = readFilters(sp, todayIn(company.time_zone), r.forward);
  const result = await r.run(supabase, company.id, f);
  const rows = result.totals ? [...result.rows, result.totals] : result.rows;
  return new NextResponse(toCsv(result.columns, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${r.id}-${f.asOf}.csv"` },
  });
}
