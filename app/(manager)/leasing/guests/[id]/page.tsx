import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui";
import { GUEST_SOURCES, GUEST_STATUS, unitName } from "@/lib/leasing";
import { requireCompany } from "@/lib/session";
import { setShowingStatus } from "../../actions";
import { GuestCardForm, SendLinkForm, ShowingForm } from "../../forms";

export const metadata = { title: "Guest card" };

const SHOWING: Record<string, string> = { scheduled: "Scheduled", done: "Shown", no_show: "No-show", canceled: "Canceled" };

export default async function GuestPage({ params }: PageProps<"/leasing/guests/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const [{ data: g }, { data: units }] = await Promise.all([
    supabase
      .from("guest_card")
      .select("id, first_name, last_name, email, phone, unit_id, source, desired_move_in, notes, status, created_at, showing(id, starts_at, status, notes, unit(label, property(name))), application(id, status)")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase.from("unit").select("id, label, property(name)").eq("company_id", company.id).in("status", ["vacant", "notice", "listed"]),
  ]);
  if (!g) notFound();
  const unitList = (units ?? []).map((u) => ({ id: u.id, name: unitName(u) }));
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: company.time_zone, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader
        title={`${g.first_name} ${g.last_name}`.trim()}
        subtitle={`Guest card · ${GUEST_STATUS[g.status]}`}
        action={
          <Link href="/leasing?tab=guests" className="text-[14px] font-semibold text-accent">
            ← Guest cards
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="p-5">
            <GuestCardForm guest={g} units={unitList} sources={GUEST_SOURCES} statuses={GUEST_STATUS} />
          </Card>
          <Card>
            <CardHeader title="Showings" />
            <div className="space-y-4 px-5 py-4">
              {g.showing.length > 0 && (
                <ul className="divide-y divide-line">
                  {g.showing
                    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
                    .map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span>
                          <span className="font-semibold">{when(s.starts_at)}</span> · {unitName(s.unit)}
                          {s.notes && <span className="block text-[13px] text-subtle">{s.notes}</span>}
                        </span>
                        {s.status === "scheduled" ? (
                          <span className="flex gap-3">
                            {(["done", "no_show", "canceled"] as const).map((st) => (
                              <form key={st} action={setShowingStatus}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="guest_card_id" value={g.id} />
                                <input type="hidden" name="status" value={st} />
                                <button className="min-h-11 text-[13px] font-semibold text-accent">{SHOWING[st]}</button>
                              </form>
                            ))}
                          </span>
                        ) : (
                          <Pill>{SHOWING[s.status]}</Pill>
                        )}
                      </li>
                    ))}
                </ul>
              )}
              <ShowingForm guestId={g.id} unitId={g.unit_id} units={unitList} />
            </div>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title="Send an application link" />
          <div className="space-y-3 px-5 py-4">
            {g.application.map((a) => (
              <p key={a.id} className="text-[14px]">
                <Link href={`/leasing/applications/${a.id}`} className="font-semibold text-accent underline">
                  Open application
                </Link>
              </p>
            ))}
            <SendLinkForm units={unitList} guest={g} />
          </div>
        </Card>
      </div>
    </>
  );
}
