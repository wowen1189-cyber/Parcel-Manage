import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill, buttonClass } from "@/components/ui";
import { readAutomationSettings } from "@/lib/automation-rules";
import { date, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { closeTask } from "./actions";

export const metadata = { title: "To do" };

export default async function TasksPage() {
  const { supabase, company } = await requireCompany();
  const today = todayIn(company.time_zone);
  const [{ data: open }, { data: recent }] = await Promise.all([
    supabase.from("automation_task").select("id, kind, title, detail, letter_template, lease_id, work_order_id, due_on, created_at").eq("company_id", company.id).eq("status", "open").order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("automation_task").select("id, kind, title, status, due_on, created_at, done_at").eq("company_id", company.id).neq("status", "open").order("created_at", { ascending: false }).limit(40),
  ]);
  const on = readAutomationSettings(company.settings).enabled;
  return (
    <>
      <PageHeader title="To do" subtitle="Notices and decisions the daily automations found. A person reviews and sends each one." />
      {!on && (
        <p className="mb-4 text-[14px] text-muted">
          Automations are off.{" "}
          <Link href="/settings/automations" className="font-semibold text-accent underline">
            Turn them on in Settings
          </Link>{" "}
          once you&apos;ve switched from your old software.
        </p>
      )}
      <Card>
        {open?.length ? (
          <ul className="divide-y divide-line">
            {open.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {t.title} {t.due_on && t.due_on <= today && <Pill tone="danger">Due {t.due_on === today ? "today" : date(t.due_on)}</Pill>}
                    {t.due_on && t.due_on > today && <Pill tone="warn">By {date(t.due_on)}</Pill>}
                  </p>
                  <p className="mt-1 text-[14px] text-muted">{t.detail}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {t.letter_template && t.lease_id && (
                    <Link href={`/communications/new?template=${t.letter_template}&lease=${t.lease_id}`} className={buttonClass("primary", true)}>
                      Prepare letter
                    </Link>
                  )}
                  {t.work_order_id && (
                    <Link href={`/maintenance/${t.work_order_id}`} className={buttonClass("secondary", true)}>
                      Open work order
                    </Link>
                  )}
                  {t.lease_id && (
                    <Link href={`/tenants/${t.lease_id}`} className="text-[14px] font-semibold text-accent">
                      Tenant
                    </Link>
                  )}
                  {(["done", "dismissed"] as const).map((s) => (
                    <form key={s} action={closeTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="min-h-11 text-[14px] font-semibold text-subtle hover:text-ink">{s === "done" ? "Done" : "Not needed"}</button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing to do">New items show up here each morning.</EmptyState>
        )}
      </Card>
      {recent && recent.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Recent activity" description="Reminders sent automatically and items closed." />
          <ul className="divide-y divide-line">
            {recent.map((t) => (
              <li key={t.id} className="flex justify-between gap-3 px-5 py-2.5 text-[14px]">
                <span>{t.title}</span>
                <span className="text-subtle">{t.status === "sent" ? `Sent ${date(t.created_at)}` : `${t.status === "done" ? "Done" : "Not needed"} ${date(t.done_at)}`}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
