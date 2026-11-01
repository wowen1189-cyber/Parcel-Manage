import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { contactName, date, todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestSubdomain } from "@/lib/session";
import { canPay, hashToken, itemsNeeded, REQUEST_ITEM, type RequestItem } from "@/lib/vendor-requests";
import { UploadItem } from "./upload-item";

export const metadata: Metadata = { title: "Vendor setup", robots: { index: false, follow: false } };

// The vendor's private setup page, opened from the request e-mail. No account: the link is the credential.
// Shows what's missing and lets them upload each document from a phone.
export default async function VendorSetupPage({ params }: PageProps<"/vendor/setup/[token]">) {
  const { token } = await params;
  const db = createAdminClient();
  const subdomain = await getRequestSubdomain();
  const { data: req } = await db
    .from("vendor_request")
    .select("id, company_id, vendor_id, items, completed_at, cancelled_at, opened_at, company(name, legal_name, subdomain, office_phone, office_email, time_zone)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!req || req.cancelled_at || req.company.subdomain !== subdomain) {
    return (
      <Shell>
        <h1 className="text-[28px] font-extrabold leading-tight">This link no longer works</h1>
        <p className="mt-3 text-muted">Each reminder we send has a new link. Open the newest e-mail from us, or call the office and we&apos;ll send a fresh one.</p>
      </Shell>
    );
  }
  if (!req.opened_at) await db.from("vendor_request").update({ opened_at: new Date().toISOString() }).eq("id", req.id);

  const { data: v } = await db
    .from("vendor")
    .select("trade, is_1099, w9_on_file, coi_expires_on, workers_comp_expires_on, dispatch_override, contact(kind, first_name, last_name, business_name)")
    .eq("id", req.vendor_id)
    .eq("company_id", req.company_id)
    .single();
  const today = todayIn(req.company.time_zone);
  const needed = v ? itemsNeeded(v, today) : [];
  const asked = req.items as RequestItem[];
  const done = (i: RequestItem) => !needed.includes(i);
  const allDone = v ? asked.every((i) => done(i) || REQUEST_ITEM[i].optional) : false;
  const onFile: Record<RequestItem, string> = {
    w9: "On file",
    coi: v?.coi_expires_on ? `On file, ends ${date(v.coi_expires_on)}` : "On file",
    workers_comp: v?.workers_comp_expires_on ? `On file, ends ${date(v.workers_comp_expires_on)}` : "On file",
  };

  return (
    <Shell company={req.company.name}>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.01em]">{allDone ? "You're all set" : "Finish your vendor setup"}</h1>
      <p className="mt-2 text-muted">
        {v ? <strong className="text-ink">{contactName(v.contact)}</strong> : null}
        {allDone
          ? `: thank you. ${req.company.name} has what it needs to send you work and pay your invoices.`
          : `: ${req.company.name} needs these before it can send you work orders${v && !canPay(v) ? " or pay your invoices" : ""}. Upload each one below; a photo from your phone is fine.`}
      </p>
      {!allDone && (
        <p className="mt-3 rounded-[var(--radius-control)] bg-surface-muted px-4 py-3 text-[14px] text-muted">
          On your insurance certificate, list <strong className="text-ink">{req.company.legal_name ?? req.company.name}</strong> as the certificate holder.
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {asked.map((item) => (
          <li key={item} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-bold">
                  {REQUEST_ITEM[item].label}
                  {REQUEST_ITEM[item].optional && <span className="ml-2 text-[13px] font-medium text-subtle">if it applies</span>}
                </h2>
                <p className="mt-1 text-[14px] text-muted">{REQUEST_ITEM[item].detail}</p>
              </div>
              {done(item) && <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-deep">{onFile[item]}</span>}
            </div>
            {!done(item) && <UploadItem token={token} item={item} needsExpiry={REQUEST_ITEM[item].needsExpiry} today={today} />}
          </li>
        ))}
      </ol>

      <p className="mt-8 text-[14px] text-subtle">
        Questions? Contact {req.company.name}
        {req.company.office_phone ? (
          <>
            {" "}at{" "}
            <a href={`tel:${req.company.office_phone.replace(/\D/g, "")}`} className="font-semibold text-accent underline">
              {req.company.office_phone}
            </a>
          </>
        ) : null}
        {req.company.office_email ? (
          <>
            {" "}or{" "}
            <a href={`mailto:${req.company.office_email}`} className="font-semibold text-accent underline">
              {req.company.office_email}
            </a>
          </>
        ) : null}
        .
      </p>
    </Shell>
  );
}

function Shell({ company, children }: { company?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:py-12">
        <div className="mb-8">
          <Logo companyName={company} />
        </div>
        {children}
      </div>
    </main>
  );
}
