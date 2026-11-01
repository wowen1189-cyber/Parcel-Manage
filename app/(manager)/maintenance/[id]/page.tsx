import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactName, date, money, oneLineAddress, todayIn } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { vendorCompliance } from "@/lib/vendors";
import { dateToZoned, earliestNoticeEntry, ENTRY_BASIS_LABEL, formatWhen, NOTICE_METHOD_LABEL, WO_PRIORITY, WO_STATUS } from "@/lib/work-orders";
import { cancelWorkOrder } from "../actions";
import { FalseEmergencyForm, AssignVendorForm, CompleteForm, NoteForm, PriorityForm, ScheduleForm, type VendorOption } from "../forms";

export async function generateMetadata({ params }: PageProps<"/maintenance/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("work_order").select("number, title").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: data ? `#${data.number} ${data.title}` : "Work order" };
}

// Which vendor trades fit each triage category (suggested first when assigning).
const TRADES_FOR: Record<string, string[]> = {
  hvac: ["HVAC"],
  plumbing: ["Plumbing"],
  appliance: ["Appliance repair"],
  electrical: ["Electrical"],
  doors: ["Handyman", "General contractor"],
  pest: ["Pest control"],
  other: ["Handyman", "General contractor"],
  safety: ["Fire & life safety", "Electrical", "Plumbing"],
};

const EVENT_LABEL: Record<string, string> = {
  created: "Request received",
  assigned: "Vendor assigned",
  notified: "Vendor emailed",
  accepted: "Vendor accepted",
  declined: "Vendor declined",
  tenant_message: "Tenant added a note",
  false_emergency_charged: "False-emergency charge posted",
  scheduled: "Visit scheduled",
  tenant_notified: "Tenants emailed",
  completed: "Completed",
  canceled: "Canceled",
  note: "Note",
  priority: "Priority changed",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2">
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function WorkOrderPage({ params, searchParams }: PageProps<"/maintenance/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const tz = company.time_zone;
  const [{ data: w }, { data: vendors }] = await Promise.all([
    supabase
      .from("work_order")
      .select(
        "*, property(id, name, address_line1, address_line2, city, state, postal_code), unit(id, label, status, access_notes, lease(status, email_notices_agreed, lease_tenant(role, is_primary, contact(id, first_name, last_name, business_name, email, mobile, phone)))), vendor(id, contact(first_name, last_name, business_name, phone, mobile, email)), work_order_event(id, kind, detail, created_at, profile(full_name, email))",
      )
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle(),
    supabase.from("vendor").select("id, trade, w9_on_file, coi_expires_on, workers_comp_expires_on, dispatch_override, contact(first_name, last_name, business_name, email)").eq("company_id", company.id).eq("is_active", true),
  ]);
  if (!w) notFound();

  const today = todayIn(tz);
  const canEdit = ["admin", "property_manager", "maintenance_coordinator"].includes(membership.role);
  const open = w.status !== "completed" && w.status !== "canceled";
  const leases = (w.unit?.lease ?? []).filter((l) => l.status === "active" || l.status === "notice");
  const people = leases.flatMap((l) => l.lease_tenant).filter((t) => t.role !== "guarantor").sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const emailAddendum = leases.some((l) => l.email_notices_agreed);
  const fit = TRADES_FOR[w.triage_category ?? ""] ?? [];
  const vendorOptions: VendorOption[] = (vendors ?? [])
    .map((v) => {
      const c = vendorCompliance(v, today);
      return { id: v.id, name: contactName(v.contact), trade: v.trade, canDispatch: c.canDispatch, issues: c.issues, matchesTrade: fit.includes(v.trade ?? ""), email: v.contact.email };
    })
    .sort((a, b) => Number(b.canDispatch) - Number(a.canDispatch) || a.name.localeCompare(b.name));
  const events = [...w.work_order_event].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const where = [w.property.name, w.unit && w.unit.label !== "Home" ? `Unit ${w.unit.label}` : null].filter(Boolean).join(" · ");
  const rules = readBusinessRules(company.settings);
  const { data: photos } = await supabase.from("document").select("storage_path, source").eq("company_id", company.id).eq("work_order_id", w.id).eq("category", "photo");
  const photoLinks = photos?.length ? ((await createAdminClient().storage.from("documents").createSignedUrls(photos.map((p) => p.storage_path), 600)).data ?? []) : [];
  const ack = w.emergency_ack as { fee_cents?: number; accepted_at?: string; text?: string } | null;
  const charged = w.work_order_event.some((e) => e.kind === "false_emergency_charged");

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/maintenance" className="font-semibold text-accent hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader
        title={w.title}
        subtitle={`#${w.number} · ${where} · opened ${date(w.created_at)}`}
        action={
          <div className="flex gap-2">
            <Pill tone={WO_PRIORITY[w.priority]?.tone ?? "neutral"}>{WO_PRIORITY[w.priority]?.label}</Pill>
            <Pill tone={WO_STATUS[w.status]?.tone ?? "neutral"}>{WO_STATUS[w.status]?.label}</Pill>
          </div>
        }
      />
      {sp.added && (
        <div className="mb-4">
          <Notice tone="success">Work order #{w.number} created. Assign a vendor below.</Notice>
        </div>
      )}
      {w.priority === "emergency" && open && (
        <div className="mb-4">
          <Notice tone="danger">Emergency: call the vendor now, and confirm with the tenant. No 24-hour notice is needed to enter in an emergency (Fla. Stat. 83.53(2)(b)).</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="The problem" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="leading-relaxed">{w.ai_summary}</p>
              {w.priority_reason && <p className="text-[13px] text-subtle">Priority changed by staff: {w.priority_reason}</p>}
              {ack?.accepted_at && (
                <p className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-[13px] text-muted">
                  The tenant accepted the false-emergency terms {formatWhen(ack.accepted_at, tz)}: &ldquo;{ack.text}&rdquo;
                </p>
              )}
              {photoLinks.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photoLinks.map((x) =>
                    x.signedUrl ? (
                      <a key={x.path} href={x.signedUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={x.signedUrl} alt="Photo on this work order" className="aspect-square w-full rounded-[10px] object-cover" />
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </Card>
          {ack?.accepted_at && !charged && canEdit && (
            <Card>
              <CardHeader title="Not really an emergency?" description="Charge the fee the tenant agreed to plus the vendor's emergency charge. Only collectible if the lease or a maintenance addendum provides for it." />
              <div className="px-5 py-4">
                <FalseEmergencyForm workOrderId={w.id} feeLabel={money(ack.fee_cents ?? 0)} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Vendor" description={w.vendor ? undefined : "Who's doing the work. On-site vendors need a W-9 and current insurance."} />
            <div className="space-y-4 px-5 py-4 text-sm">
              {w.vendor && (
                <p>
                  <span className="font-semibold">{contactName(w.vendor.contact)}</span>
                  <span className="text-subtle"> · {[w.vendor.contact.phone ?? w.vendor.contact.mobile, w.vendor.contact.email].filter(Boolean).join(" · ")}</span>
                  {w.vendor_notified_at && <span className="block text-[13px] text-subtle">Emailed {formatWhen(w.vendor_notified_at, tz)}</span>}
                </p>
              )}
              {open && canEdit && <AssignVendorForm workOrderId={w.id} vendors={vendorOptions} currentVendorId={w.vendor?.id ?? null} />}
            </div>
          </Card>

          <Card>
            <CardHeader title="Visit" />
            <div className="space-y-4 px-5 py-4 text-sm">
              {w.scheduled_start && (
                <dl className="divide-y divide-line">
                  <Row label="When">
                    {formatWhen(w.scheduled_start, tz)} to {w.scheduled_end ? new Date(w.scheduled_end).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }) : "?"}
                  </Row>
                  <Row label="Entry">
                    {w.entry_basis === "notice" && !w.entry_notice_method ? <span className="font-semibold text-warn">Notice not recorded yet: post or hand-deliver the 24-hour notice, then save the visit with how it was given</span> : (ENTRY_BASIS_LABEL[w.entry_basis ?? ""] ?? "—")}
                    {w.entry_notice_method && (
                      <span className="text-subtle">
                        {" "}
                        · {NOTICE_METHOD_LABEL[w.entry_notice_method]} {w.entry_notice_at && formatWhen(w.entry_notice_at, tz)}
                      </span>
                    )}
                  </Row>
                </dl>
              )}
              {open && canEdit && (
                <ScheduleForm
                  workOrderId={w.id}
                  emergency={w.priority === "emergency"}
                  vacant={!w.unit || w.unit.status === "vacant" || !leases.length}
                  earliest={dateToZoned(earliestNoticeEntry(new Date(), rules), tz)}
                  current={{
                    start: w.scheduled_start ? dateToZoned(new Date(w.scheduled_start), tz) : "",
                    end: w.scheduled_end ? dateToZoned(new Date(w.scheduled_end), tz) : "",
                    basis: w.entry_basis,
                    method: w.entry_notice_method,
                  }}
                  hasTenantEmail={people.some((p) => p.contact.email)}
                  emailAddendum={emailAddendum}
                />
              )}
            </div>
          </Card>

          {open && canEdit ? (
            <Card>
              <CardHeader title="Complete" />
              <div className="px-5 py-4">
                <CompleteForm workOrderId={w.id} />
              </div>
            </Card>
          ) : (
            w.status === "completed" && (
              <Card>
                <CardHeader title="Completed" />
                <dl className="divide-y divide-line px-5 py-2 text-sm">
                  <Row label="Done">{formatWhen(w.completed_at, tz)}</Row>
                  <Row label="What was done">{w.resolution}</Row>
                  {w.cost_cents != null && <Row label="Cost">{money(w.cost_cents)}</Row>}
                </dl>
              </Card>
            )
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={w.unit ? "Tenants" : "Location"} />
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="text-muted">{oneLineAddress(w.property)}</p>
              {people.length ? (
                people.map((p) => (
                  <div key={p.contact.id}>
                    <p className="font-semibold">{contactName(p.contact)}</p>
                    <p className="text-[13px]">
                      {[p.contact.mobile && <a key="m" href={`tel:${p.contact.mobile.replace(/\D/g, "")}`} className="text-accent hover:underline">{p.contact.mobile}</a>, p.contact.email && <a key="e" href={`mailto:${p.contact.email}`} className="text-accent hover:underline">{p.contact.email}</a>]
                        .filter(Boolean)
                        .reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), []) }
                      {!p.contact.mobile && !p.contact.email && <span className="text-warn">No phone or email on file</span>}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-subtle">{w.unit ? "No current tenant (vacant)." : "Common area or whole building."}</p>
              )}
              {w.unit?.access_notes && <p className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2 text-[13px]"><span className="font-semibold">Access (staff only):</span> {w.unit.access_notes}</p>}
              <dl className="divide-y divide-line border-t border-line pt-1">
                {w.room && <Row label="Room">{w.room}</Row>}
                {w.entry_ok != null && <Row label="Entry if away">{w.entry_ok ? "OK to enter" : "Wants to be home"}</Row>}
                {w.pets_in_home != null && <Row label="Pets">{w.pets_in_home ? "Yes" : "No"}</Row>}
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-4 px-5 py-4">
              {canEdit && <NoteForm workOrderId={w.id} />}
              <ol className="space-y-3 border-l border-line pl-4 text-sm">
                {events.map((e) => {
                  const d = (e.detail ?? {}) as Record<string, unknown>;
                  const extra =
                    e.kind === "note" ? String(d.note ?? "") :
                    e.kind === "assigned" ? String(d.vendor ?? "") :
                    e.kind === "notified" ? `${d.sent ? "Sent to" : "Failed to send to"} ${String(d.to ?? "")}` :
                    e.kind === "tenant_notified" ? `${d.sent ? "Sent to" : "Failed to send to"} ${(d.to as string[] | undefined)?.join(", ") ?? ""}` :
                    e.kind === "scheduled" ? `${formatWhen(String(d.start), tz)}${d.by === "vendor" ? " · by the vendor" : ""} · ${d.entry_basis === "notice" && d.by === "vendor" && !w.entry_notice_method ? "24-hour notice still to post or hand-deliver" : (ENTRY_BASIS_LABEL[String(d.entry_basis)] ?? "")}` :
                    e.kind === "completed" ? String(d.resolution ?? "") :
                    e.kind === "priority" ? `${String(d.priority)}: ${String(d.reason ?? "")}` :
                    e.kind === "canceled" ? String(d.reason ?? "") :
                    e.kind === "created" ? `From ${String(d.source ?? "")}` : "";
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" aria-hidden />
                      <p className="font-semibold">{EVENT_LABEL[e.kind] ?? e.kind}</p>
                      {extra && <p className="text-muted">{extra}</p>}
                      <p className="text-[12px] text-subtle">
                        {formatWhen(e.created_at, tz)}
                        {e.profile && ` · ${e.profile.full_name ?? e.profile.email}`}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Card>

          {open && canEdit && (
            <Card>
              <CardHeader title="Priority" />
              <div className="space-y-4 px-5 py-4">
                <PriorityForm workOrderId={w.id} priority={w.priority} />
                <form action={cancelWorkOrder} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
                  <input type="hidden" name="work_order_id" value={w.id} />
                  <label className="min-w-[180px] flex-1">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Cancel this work order</span>
                    <input name="reason" placeholder="Reason (optional)" className="min-h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm" />
                  </label>
                  <button type="submit" className="min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-danger hover:bg-danger-bg">
                    Cancel work order
                  </button>
                </form>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
