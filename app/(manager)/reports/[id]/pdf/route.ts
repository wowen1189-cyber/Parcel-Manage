import { NextResponse } from "next/server";
import { reportPdf } from "@/lib/report-export";
import { runReportFromUrl } from "@/lib/report-run";

export async function GET(request: Request, ctx: RouteContext<"/reports/[id]/pdf">) {
  const run = await runReportFromUrl((await ctx.params).id, request.url);
  if (!run) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const file = await reportPdf({ title: run.report.title, filtersLine: run.filtersLine, ...run.result }, run.company.legal_name ?? run.company.name);
  return new NextResponse(new Uint8Array(file), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${run.report.id}-${run.f.asOf}.pdf"` },
  });
}
