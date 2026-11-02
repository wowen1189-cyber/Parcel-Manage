import { NextResponse } from "next/server";
import { toCsv } from "@/lib/report-math";
import { runReportFromUrl } from "@/lib/report-run";

export async function GET(request: Request, ctx: RouteContext<"/reports/[id]/csv">) {
  const run = await runReportFromUrl((await ctx.params).id, request.url);
  if (!run) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const rows = run.result.totals ? [...run.result.rows, run.result.totals] : run.result.rows;
  return new NextResponse(toCsv(run.result.columns, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${run.report.id}-${run.f.asOf}.csv"` },
  });
}
