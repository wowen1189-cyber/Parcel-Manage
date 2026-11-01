import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, CardHeader, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { contactName, date, todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { canPay, itemsNeeded, MAX_SENDS, REMINDER_EVERY_DAYS, REQUEST_ITEM, requiredItems } from "@/lib/vendor-requests";
import { cancelPaperworkRequest } from "../actions";
import { RequestPaperworkButton } from "../request-button";
import { isAdmin, requireCompany } from "@/lib/session";
import { vendorCompliance } from "@/lib/vendors";
import { VendorForm } from "../forms";
import { PaperworkPill } from "../paperwork-pill";

export async function generateMetadata({ params }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase.from("vendor").select("contact(first_name, last_name, business_name)").eq("id", id).eq("company_id", company.id).maybeSingle();
  return { title: contactName(data?.contact) || "Vendor" };
}

export default async function VendorPage({ params, searchParams }: PageProps<"/vendors/[id]">) {
  const { id } = await params;
  const added = Boolean((await searchParams).added);
  const { supabase, company, membership } = await requireCompany();
  const { data: v } = await supabase.from("vendor").select("*, contact(*)").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!v) notFound();
  const today = todayIn(company.time_zone);
  const compliance = vendorCompliance(v, today);
  const c = v.contact;
  const canEdit = ["admin", "property_manager", "maintenance_coordinator", "accountant"].includes(membership.role);
  const [{ data: requests }, { data: docs }] = await Promise.all([
    supabase.from("vendor_request").select("id, items, sent_to, send_count, first_sent_at, last_sent_at, opened_at, completed_at, cancelled_at").eq("company_id", company.id).eq("vendor_id", v.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("document").select("id, file_name, storage_path, category, expires_on, created_at").eq("company_id", company.id).eq("vendor_id", v.id).order("created_at", { ascending: false }),
  ]);
  const request = requests?.[0];
  const open = request && !request.completed_at && !request.cancelled_at ? request : null;
  const missing = requiredItems(itemsNeeded(v, today));
  // Short-lived links to the private files (storage is server-only).
  const links = new Map<string, string>();
  if (docs?.length) {
    const { data: signed } = await createAdminClient().storage.from("documents").createSignedUrls(docs.map((d) => d.storage_path), 600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) links.set(s.path, s.signedUrl);
  }

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/vendors" className="font-semibold text-accent hover:underline">
          ← Vendors
        </Link>
      </p>
      <PageHeader title={contactName(c)} subtitle={[v.trade, c.phone ?? c.mobile, c.email].filter(Boolean).join(" · ")} />
      {added && (
        <div className="mb-6">
          <Notice tone="success">Vendor added. Record their W-9 and insurance below so they can be sent work orders.</Notice>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Paperwork" value={<PaperworkPill compliance={compliance} />} />
        <StatTile label="Insurance expires" value={<span className="text-xl">{date(v.coi_expires_on, { blank: "Not on file" })}</span>} />
        <StatTile label="Can be paid" value={<span className="text-xl">{canPay(v) ? "Yes" : "No: needs a W-9"}</span>} note={`Last paid ${date(v.last_paid_on)}`} />
      </div>
      <Card className="mb-6">
        <CardHeader
          title="Paperwork"
          description={
            open
              ? `Requested ${date(open.first_sent_at.slice(0, 10))}, sent ${open.send_count} time${open.send_count === 1 ? "" : "s"} to ${open.sent_to}${open.opened_at ? ", link opened" : ""}. Reminders every ${REMINDER_EVERY_DAYS} days (up to ${MAX_SENDS}).`
              : missing.length
                ? `Missing: ${missing.map((i) => REQUEST_ITEM[i].label).join(", ")}. Send a request and they can upload it from their phone.`
                : "W-9 and insurance are on file."
          }
          action={open ? <Pill tone="info">Requested</Pill> : request?.completed_at ? <Pill tone="success">Received {date(request.completed_at.slice(0, 10))}</Pill> : undefined}
        />
        <div className="space-y-4 px-5 py-4">
          {canEdit && (missing.length > 0 || open) && (
            <div className="flex flex-wrap items-start gap-3">
              {!c.email ? (
                <Notice tone="warn">Add their e-mail below to send a request.</Notice>
              ) : (
                <RequestPaperworkButton vendorId={v.id} label={open ? "Send a reminder now" : "Request paperwork"} reminder={Boolean(open)} />
              )}
              {open && (
                <form action={cancelPaperworkRequest}>
                  <input type="hidden" name="vendor_id" value={v.id} />
                  <Button type="submit" small variant="ghost">
                    Stop reminders
                  </Button>
                </form>
              )}
            </div>
          )}
          {docs?.length ? (
            <ul className="divide-y divide-line text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {links.get(d.storage_path) ? (
                      <a href={links.get(d.storage_path)} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                        {d.file_name}
                      </a>
                    ) : (
                      d.file_name
                    )}
                    <span className="ml-2 text-[13px] text-subtle">uploaded {date(d.created_at.slice(0, 10))}</span>
                  </span>
                  {d.expires_on && <span className="text-[13px] text-subtle">ends {date(d.expires_on)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-subtle">No documents uploaded yet.</p>
          )}
        </div>
      </Card>
      <VendorForm
        canEdit={canEdit}
        canOverride={isAdmin(membership)}
        vendor={{
          id: v.id,
          contact_id: c.id,
          kind: c.kind,
          business_name: c.business_name,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          mobile: c.mobile,
          address_line1: c.address_line1,
          address_line2: c.address_line2,
          city: c.city,
          state: c.state,
          postal_code: c.postal_code,
          contact_notes: c.notes,
          trade: v.trade,
          payment_method: v.payment_method,
          is_1099: v.is_1099,
          w9_on_file: v.w9_on_file,
          w9_received_on: v.w9_received_on,
          coi_expires_on: v.coi_expires_on,
          workers_comp_expires_on: v.workers_comp_expires_on,
          auto_insurance_expires_on: v.auto_insurance_expires_on,
          license_expires_on: v.license_expires_on,
          epa_cert_expires_on: v.epa_cert_expires_on,
          contract_expires_on: v.contract_expires_on,
          dispatch_override: v.dispatch_override,
          notes: v.notes,
        }}
      />
    </>
  );
}
