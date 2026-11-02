import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { companyEvents, personalEvents } from "@/lib/calendar";
import { ROOT_DOMAIN } from "@/lib/env";
import { conflicts } from "@/lib/ical";
import { requireCompany } from "@/lib/session";
import { companyUrl } from "@/lib/tenant";
import { removeCalendar, stopFeedLink } from "./actions";
import { AddCalendarForm, FeedLink } from "./forms";

export const metadata = { title: "Calendar" };

const KIND: Record<string, { label: string; tone: "info" | "warn" | "success" | "neutral" | "danger" }> = {
  showing: { label: "Showing", tone: "success" },
  repair: { label: "Repair visit", tone: "info" },
  move_out: { label: "Move-out", tone: "warn" },
  lease_end: { label: "Lease ends", tone: "neutral" },
  todo: { label: "To do", tone: "danger" },
};

// Two weeks of Parcel Manage dates next to the person's own calendars, and the self-serve connection:
// a private link to subscribe from Google Calendar, and their calendars' secret iCal addresses.
export default async function CalendarPage() {
  const { supabase, company, user } = await requireCompany();
  const tz = company.time_zone;
  const now = new Date();
  const from = new Date(now.getTime() - 86_400_000);
  const to = new Date(now.getTime() + 15 * 86_400_000);
  const base = company.subdomain ? companyUrl(company.subdomain, ROOT_DOMAIN, "").replace(/\/$/, "") : "";
  const [events, mine, { data: feed }, { data: cals }] = await Promise.all([
    companyEvents(supabase, company.id, from.toISOString(), to.toISOString(), base),
    personalEvents(supabase, company.id, user.id, from, to, tz),
    supabase.from("calendar_feed").select("created_at, last_read_at").eq("company_id", company.id).eq("profile_id", user.id).maybeSingle(),
    supabase.from("external_calendar").select("id, name, last_fetched_at, last_error").eq("company_id", company.id).eq("profile_id", user.id).order("created_at"),
  ]);

  const dayKey = (iso: string, allDay: boolean) => (allDay ? iso.slice(0, 10) : new Date(iso).toLocaleDateString("en-CA", { timeZone: tz }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  type Row = { key: string; time: string; title: string; tag: React.ReactNode; href?: string; warn?: string; sort: string };
  const rows: Row[] = [
    ...events.map((e) => {
      const clash = e.kind === "showing" ? conflicts(mine, new Date(e.start), new Date(e.end ?? e.start)) : [];
      return {
        key: dayKey(e.start, !!e.allDay),
        time: e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }),
        title: e.kind === "todo" ? e.title.replace(/^To do: /, "") : e.title,
        tag: <Pill tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Pill>,
        href: e.href,
        warn: clash.length ? `Overlaps "${clash[0].title}" on your ${clash[0].calendar} calendar` : undefined,
        sort: e.allDay ? `${e.start.slice(0, 10)}T00` : e.start,
      };
    }),
    ...mine.map((e) => ({
      key: dayKey(e.start, e.allDay),
      time: e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }),
      title: e.title,
      tag: <Pill>{e.calendar}</Pill>,
      sort: e.allDay ? `${e.start.slice(0, 10)}T00` : e.start,
    })),
  ]
    .filter((r) => r.key >= today)
    .sort((a, b) => a.sort.localeCompare(b.sort));
  const days = [...new Set(rows.map((r) => r.key))];

  return (
    <>
      <PageHeader title="Calendar" subtitle="The next two weeks: showings, repair visits, move-outs, lease endings and to-dos, next to your own calendars." />
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card className="overflow-hidden">
          {days.length ? (
            <div className="divide-y divide-line">
              {days.map((d) => (
                <section key={d} className="px-5 py-3">
                  <h2 className="mb-2 text-[13px] font-bold text-muted">{d === today ? "Today" : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</h2>
                  <ul className="space-y-1.5">
                    {rows
                      .filter((r) => r.key === d)
                      .map((r, i) => (
                        <li key={i} className="grid grid-cols-[72px_1fr] gap-3 text-[14px]">
                          <span className="tabular text-muted">{r.time}</span>
                          <span>
                            {r.tag}{" "}
                            {r.href ? (
                              <Link href={r.href} className="font-semibold hover:underline">
                                {r.title}
                              </Link>
                            ) : (
                              <span className="text-ink-2">{r.title}</span>
                            )}
                            {r.warn && <span className="block text-[13px] font-medium text-danger">{r.warn}</span>}
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing in the next two weeks">Showings, scheduled repairs, move-outs, lease endings and to-dos show here.</EmptyState>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="See Parcel Manage in Google Calendar" description="A private link only you have. Your calendar app re-reads it every few hours." />
            <div className="space-y-3 px-5 py-4 text-[14px]">
              <FeedLink base={base} hasLink={!!feed} />
              {feed && (
                <div className="text-[13px] text-subtle">
                  Link made {new Date(feed.created_at).toLocaleDateString("en-US", { timeZone: tz })}
                  {feed.last_read_at ? `, last read by your calendar ${new Date(feed.last_read_at).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" })}` : ", not read yet"}.{" "}
                  <form action={stopFeedLink} className="inline">
                    <button type="submit" className="font-semibold text-danger hover:underline">
                      Turn off
                    </button>
                  </form>
                </div>
              )}
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>Make your link and copy it.</li>
                <li>In Google Calendar on a computer: next to &ldquo;Other calendars&rdquo;, click + → From URL.</li>
                <li>Paste the link and click Add calendar. Outlook and Apple Calendar have the same &ldquo;subscribe&rdquo; option.</li>
              </ol>
            </div>
          </Card>

          <Card>
            <CardHeader title="Show your calendars here" description="So your appointments sit next to Parcel Manage's, and double-booked showings are flagged. Only you see these." />
            <div className="space-y-4 px-5 py-4 text-[14px]">
              {(cals ?? []).length > 0 && (
                <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                  {(cals ?? []).map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="font-semibold">{c.name}</span>
                        <span className={`block text-[13px] ${c.last_error ? "text-danger" : "text-subtle"}`}>{c.last_error ?? (c.last_fetched_at ? `Read ${new Date(c.last_fetched_at).toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" })}` : "Not read yet")}</span>
                      </span>
                      <form action={removeCalendar.bind(null, c.id)}>
                        <button type="submit" className="text-[13px] font-semibold text-danger hover:underline">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <AddCalendarForm />
              <ol className="list-decimal space-y-1 pl-5 text-muted">
                <li>In Google Calendar on a computer: Settings (gear) → click your calendar under &ldquo;Settings for my calendars&rdquo;.</li>
                <li>Scroll to &ldquo;Integrate calendar&rdquo; and copy &ldquo;Secret address in iCal format&rdquo;.</li>
                <li>Paste it above. Keep it private: anyone with it can see that calendar. You can reset it in Google any time.</li>
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
