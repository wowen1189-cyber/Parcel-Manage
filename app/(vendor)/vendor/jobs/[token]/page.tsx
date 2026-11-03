import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { Card, CardHeader, Pill } from "@/components/ui";
import { readBusinessRules } from "@/lib/business-rules";
import { contactName, oneLineAddress } from "@/lib/format";
import { loadJob } from "@/lib/vendor-jobs";
import { dateToZoned, earliestNoticeEntry, formatWhen, WO_PRIORITY } from "@/lib/work-orders";
import { JobFinish } from "@/components/job-finish";
import { aiReady } from "@/lib/job-finish";
import { hoursSince } from "@/lib/job-finish-rules";
import { finishJob, jobReadInvoice, jobWriteUp, startJobUpload } from "./actions";
import { AcceptDecline, CheckInButton, ScheduleForm, VendorTextsForm } from "./job-forms";
import { vendorSmsConsentText } from "@/lib/sms-consent";

export const metadata: Metadata = { title: "Work order", robots: { index: false, follow: false } };
// The AI write-up and invoice reading can take most of a minute.
export const maxDuration = 60;

// The vendor's private job page, from the work order e-mail: details, accept or decline, schedule, finish.
export default async function VendorJobPage({ params }: PageProps<"/vendor/jobs/[token]">) {
  const { token } = await params;
  const found = await loadJob(token);
  if (!found) {
    return (
      <Shell>
        <h1 className="text-[26px] font-extrabold">This link no longer works</h1>
        <p className="mt-2 text-muted">The job may have been reassigned or canceled. Call the office if you have questions.</p>
      </Shell>
    );
  }
  const { db, wo } = found;
  const tz = wo.company.time_zone;
  const lease = wo.unit?.lease.find((l) => l.status === "active" || l.status === "notice");
  const tenants = (lease?.lease_tenant ?? []).filter((t) => t.role === "tenant");
  // The tenant's photos of the problem (the vendor's own before/after photos are saved with the finished job).
  const { data: photos } = await db.from("document").select("storage_path").eq("company_id", wo.company_id).eq("work_order_id", wo.id).eq("category", "photo").or("photo_stage.is.null,photo_stage.eq.problem");
  const signed = photos?.length ? ((await db.storage.from("documents").createSignedUrls(photos.map((p) => p.storage_path), 600)).data ?? []) : [];
  const earliest = dateToZoned(earliestNoticeEntry(new Date(), readBusinessRules(wo.company.settings)), tz).slice(0, 16);
  const emergency = wo.priority === "emergency";
  const done = Boolean(wo.completed_at);
  const ai = done ? false : await aiReady(wo.company_id);
  const address = oneLineAddress(wo.property);
  const phone = (s: string | null | undefined) => (s ? s.replace(/[^\d+]/g, "") : null);

  return (
    <Shell company={wo.company.name}>
      <p className="text-[14px] text-subtle">Work order #{wo.number}</p>
      <h1 className="text-[26px] font-extrabold leading-tight">{wo.title}</h1>
      <p className="mt-2 flex flex-wrap gap-2">
        <Pill tone={WO_PRIORITY[wo.priority]?.tone ?? "neutral"}>{WO_PRIORITY[wo.priority]?.label}</Pill>
        {done ? <Pill tone="success">Done</Pill> : wo.scheduled_start ? <Pill tone="info">Scheduled {formatWhen(wo.scheduled_start, tz)}</Pill> : wo.vendor_accepted_at ? <Pill tone="info">Accepted</Pill> : null}
      </p>

      <Card className="mt-5 p-5 text-[15px]">
        <p className="font-semibold">
          {wo.property.name}
          {wo.unit && wo.unit.label !== "Home" ? `, Unit ${wo.unit.label}` : ""}
        </p>
        <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
          {address} · Map
        </a>
        {wo.ai_summary && <p className="mt-3 whitespace-pre-wrap">{wo.ai_summary}</p>}
        <ul className="mt-3 space-y-1 text-[14px] text-muted">
          {wo.room && <li>Room: {wo.room}</li>}
          {wo.entry_ok != null && <li>{wo.entry_ok ? "OK to enter if no one is home (after notice)." : "Tenant wants to be home."}</li>}
          {wo.pets_in_home && <li>Pets in the home.</li>}
          {tenants.map((t, i) => {
            const tel = phone(t.contact.mobile ?? t.contact.phone);
            return (
              <li key={i}>
                Tenant: {contactName(t.contact)}
                {tel && (
                  <>
                    {" · "}
                    <a href={`tel:${tel}`} className="font-semibold text-accent">
                      Call {t.contact.mobile ?? t.contact.phone}
                    </a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {signed.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
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
      </Card>

      {!done && !wo.vendor_accepted_at && (
        <Card className="mt-4 p-5">
          <AcceptDecline token={token} />
        </Card>
      )}
      {!done && wo.vendor_accepted_at && (
        <Card className="mt-4">
          <CardHeader title={wo.scheduled_start ? "Change the visit time" : "Pick a time"} />
          <div className="px-5 py-4">
            <ScheduleForm token={token} earliest={earliest} emergency={emergency} />
          </div>
        </Card>
      )}
      {!done && wo.vendor_accepted_at && (
        <Card className="mt-4 p-5">
          {wo.tech_arrived_at ? (
            <p className="text-[14px] font-semibold text-accent-deep">✓ Checked in {formatWhen(wo.tech_arrived_at, tz)}</p>
          ) : (
            <>
              <p className="mb-3 text-[14px] text-muted">At the property? Check in so the office knows you&apos;re there.</p>
              <CheckInButton token={token} />
            </>
          )}
        </Card>
      )}
      {!done && wo.vendor_accepted_at && (
        <Card className="mt-4">
          <CardHeader title="Finish the job" description="Photos, what you did, and your invoice. A minute or two." />
          <div className="px-5 py-4">
            <JobFinish
              who="vendor"
              aiReady={ai}
              suggestedHours={hoursSince(wo.tech_arrived_at, new Date())}
              startUpload={startJobUpload.bind(null, token)}
              writeUp={jobWriteUp.bind(null, token)}
              readInvoice={jobReadInvoice.bind(null, token)}
              finish={finishJob.bind(null, token)}
            />
          </div>
        </Card>
      )}
      {done && (
        <Card className="mt-4 p-5">
          <p className="font-semibold">Marked done. Thank you!</p>
          {wo.resolution && <p className="mt-1 text-muted">{wo.resolution}</p>}
        </Card>
      )}
      {wo.vendor && (
        <Card className="mt-4 p-5">
          <h2 className="mb-3 font-semibold">Get new jobs by text</h2>
          <VendorTextsForm token={token} on={wo.vendor.contact.sms_opt_in} mobile={wo.vendor.contact.mobile ?? ""} consent={vendorSmsConsentText(wo.company.name)} />
        </Card>
      )}
      <p className="mt-8 text-[14px] text-subtle">
        Questions? Call {wo.company.name}
        {wo.company.office_phone ? ` at ${wo.company.office_phone}` : ""}.
      </p>
    </Shell>
  );
}

function Shell({ company, children }: { company?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[640px] px-4 py-8">
        <div className="mb-6">
          <Logo companyName={company} />
        </div>
        {children}
      </div>
    </main>
  );
}
