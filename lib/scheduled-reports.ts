import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText } from "@/lib/email/layout";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { toCsv } from "@/lib/report-math";
import { FREQUENCIES, dueOn, periodFor } from "@/lib/report-schedule";
import { reportById } from "@/lib/reports";
import type { Database } from "@/lib/supabase/database.types";

// Sends each scheduled report on its day with the CSV attached, once per day (automation_task key).
export async function runScheduledReports(db: SupabaseClient<Database>, company: { id: string; name: string; office_email: string | null }, today: string) {
  const { data: schedules } = await db.from("scheduled_report").select("id, report_key, scope, frequency, recipients").eq("company_id", company.id).eq("active", true);
  let sent = 0;
  for (const s of schedules ?? []) {
    const r = reportById(s.report_key);
    if (!r?.run || !dueOn(s.frequency, today)) continue;
    const { error: dup } = await db.from("automation_task").insert({ company_id: company.id, key: `report:${s.id}:${today}`, kind: "scheduled_report", title: `Report sent: ${r.title}`, status: "sent", due_on: today });
    if (dup) continue;
    const scope = (s.scope ?? {}) as { owner?: string; property?: string };
    const period = periodFor(s.frequency, today);
    const result = await r.run(db, company.id, { ...period, asOf: today, owner: scope.owner ?? "", property: scope.property ?? "" });
    const to = ((s.recipients ?? []) as { email?: string }[]).map((x) => x.email).filter((e): e is string => Boolean(e));
    if (!to.length) continue;
    const csv = toCsv(result.columns, result.totals ? [...result.rows, result.totals] : result.rows);
    const content = {
      preheader: `${r.title} for ${period.from} to ${period.to}`,
      heading: r.title,
      paragraphs: [`Your ${escapeHtml(FREQUENCIES[s.frequency]?.toLowerCase() ?? "")} ${escapeHtml(r.title.toLowerCase())} from ${escapeHtml(company.name)} is attached (${result.rows.length} rows, ${period.from} to ${period.to}).`, ...(result.note ? [escapeHtml(result.note)] : [])],
      fromLine: company.name,
    };
    if (await sendEmail({ to, subject: `${r.title}: ${period.from} to ${period.to}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email, attachments: [{ filename: `${r.id}-${today}.csv`, content: Buffer.from(csv).toString("base64") }] })) sent++;
  }
  return sent;
}
