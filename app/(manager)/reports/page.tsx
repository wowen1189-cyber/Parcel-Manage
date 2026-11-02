import Link from "next/link";
import { Card, PageHeader, Pill } from "@/components/ui";
import { REPORTS } from "@/lib/reports";
import { FREQUENCIES } from "@/lib/report-schedule";
import { reportById } from "@/lib/reports";
import { requireCompany } from "@/lib/session";
import { setSchedule } from "./actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase, company } = await requireCompany();
  const { data: schedules } = await supabase.from("scheduled_report").select("id, report_key, frequency, recipients, active").eq("company_id", company.id).order("created_at");
  const groups = [...new Set(REPORTS.map((r) => r.group))];
  return (
    <>
      <PageHeader title="Reports" subtitle={`${REPORTS.filter((r) => r.run).length} of ${REPORTS.length} reports ready. Each one replaces several reports from your old software, with filters and Excel, PDF and CSV export.`} />
      {schedules && schedules.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="mb-3 text-[17px] font-bold">Scheduled e-mails</h2>
          <ul className="divide-y divide-line">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[14px]">
                <span>
                  <span className="font-semibold">{reportById(s.report_key)?.title ?? s.report_key}</span> · {FREQUENCIES[s.frequency] ?? s.frequency} · {((s.recipients ?? []) as { email?: string }[]).map((x) => x.email).join(", ")} {!s.active && <Pill>Paused</Pill>}
                </span>
                <span className="flex gap-3">
                  {(s.active ? ["pause", "delete"] : ["resume", "delete"]).map((op) => (
                    <form key={op} action={setSchedule}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="op" value={op} />
                      <button className={`min-h-11 font-semibold ${op === "delete" ? "text-danger" : "text-accent"}`}>{op === "pause" ? "Pause" : op === "resume" ? "Resume" : "Remove"}</button>
                    </form>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} className="p-5">
            <h2 className="mb-3 text-[17px] font-bold">{g}</h2>
            <ul className="space-y-2.5">
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <li key={r.id}>
                  {r.run ? (
                    <Link href={`/reports/${r.id}`} className="font-semibold text-accent hover:underline">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-muted">
                      {r.title} <Pill>Not built yet</Pill>
                    </span>
                  )}
                  <p className="text-[12px] text-subtle">Replaces: {r.replaces}</p>
                  {!r.run && r.needs && <p className="text-[12px] text-subtle">Waiting for: {r.needs}</p>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
