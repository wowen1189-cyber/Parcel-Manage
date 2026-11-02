import { NextResponse } from "next/server";
import { reportXlsx } from "@/lib/report-export";
import { runReportFromUrl } from "@/lib/report-run";

export async function GET(request: Request, ctx: RouteContext<"/reports/[id]/xlsx">) {
  const run = await runReportFromUrl((await ctx.params).id, request.url);
  if (!run) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const file = await reportXlsx({ title: run.report.title, filtersLine: run.filtersLine, ...run.result });
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${run.report.id}-${run.f.asOf}.xlsx"` },
  });
}
