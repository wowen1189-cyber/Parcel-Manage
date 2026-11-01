import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, Pill } from "@/components/ui";
import { date } from "@/lib/format";
import { requireTenant } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhen, WO_PRIORITY, WO_STATUS } from "@/lib/work-orders";
import { PhotoUpload } from "./photo-upload";

export const metadata = { title: "Repair request" };

const EVENT: Record<string, string> = { created: "Request sent", scheduled: "Visit scheduled", completed: "Marked fixed", canceled: "Canceled", tenant_message: "You added a note" };

export default async function RequestPage({ params, searchParams }: PageProps<"/portal/maintenance/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company } = await requireTenant();
  const { data: wo } = await supabase.from("work_order").select("id, number, title, status, priority, created_at, scheduled_start, scheduled_end, completed_at, resolution, tenant_note").eq("id", id).maybeSingle();
  if (!wo) notFound();
  const [{ data: events }, photos] = await Promise.all([
    supabase.from("work_order_event").select("id, kind, created_at").eq("work_order_id", wo.id).order("created_at"),
    // Photos are in private storage; the tenant's access to this request was just checked above.
    createAdminClient().from("document").select("id, storage_path").eq("company_id", company.id).eq("work_order_id", wo.id).eq("category", "photo"),
  ]);
  const signed = photos.data?.length ? (await createAdminClient().storage.from("documents").createSignedUrls(photos.data.map((p) => p.storage_path), 600)).data ?? [] : [];
  const tz = company.time_zone;

  return (
    <div className="space-y-4">
      <p className="text-[14px]">
        <Link href="/portal/maintenance" className="font-semibold text-accent">
          ← Repairs
        </Link>
      </p>
      {sp.sent && <Notice tone="success">Sent! We&apos;ll let you know when it&apos;s scheduled. Add photos below if you can; they help the technician.</Notice>}
      <div>
        <h1 className="text-[24px] font-extrabold leading-tight">{wo.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-subtle">
          #{wo.number} · sent {date(wo.created_at.slice(0, 10))} <Pill tone={WO_STATUS[wo.status]?.tone ?? "neutral"}>{WO_STATUS[wo.status]?.label}</Pill> <Pill tone={WO_PRIORITY[wo.priority]?.tone ?? "neutral"}>{WO_PRIORITY[wo.priority]?.label}</Pill>
        </p>
      </div>
      {wo.scheduled_start && !wo.completed_at && (
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-subtle">Scheduled visit</p>
          <p className="mt-1 text-[18px] font-bold">{formatWhen(wo.scheduled_start, tz)}</p>
        </Card>
      )}
      {wo.completed_at && (
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-subtle">Fixed {date(wo.completed_at.slice(0, 10))}</p>
          {wo.resolution && <p className="mt-1">{wo.resolution}</p>}
        </Card>
      )}
      <Card>
        <CardHeader title="Photos" />
        <div className="space-y-3 px-5 py-4">
          {signed.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {signed.map((s) =>
                s.signedUrl ? (
                  <a key={s.path} href={s.signedUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.signedUrl} alt="Photo of the problem" className="aspect-square w-full rounded-[10px] object-cover" />
                  </a>
                ) : null,
              )}
            </div>
          )}
          {!wo.completed_at && wo.status !== "canceled" && <PhotoUpload workOrderId={wo.id} />}
        </div>
      </Card>
      <Card>
        <CardHeader title="Updates" />
        <ol className="space-y-2 px-5 py-4 text-[14px]">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{EVENT[e.kind] ?? e.kind}</span>
              <span className="text-subtle">{date(e.created_at.slice(0, 10))}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
