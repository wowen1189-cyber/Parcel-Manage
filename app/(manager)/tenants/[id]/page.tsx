import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Pill, StatTile } from "@/components/ui";
import { markLeaseSigned, stopTexts } from "../actions";
import { readBusinessRules } from "@/lib/business-rules";
import { bedBath, contactName, date, money, todayIn } from "@/lib/format";
import { lateFeeText, leaseTiming } from "@/lib/leases";
import { requireCompany } from "@/lib/session";
import { LeaseNotesForm, BillingSettingsForm, TenantContactForm } from "../forms";
import { HouseholdCard } from "./household";
import { ChargeForm, PaymentForm, ReturnPaymentButton } from "./ledger";
import { InviteButton, ReplyForm } from "./portal";
import { buildLedger } from "@/lib/ledger";
import { depositHeldCents } from "@/lib/deposits";
import { createAdminClient } from "@/lib/supabase/admin";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { smsStatus } from "@/lib/sms-consent";
import { DOCUMENT_CATEGORIES } from "../document-labels";
import { TenantDocumentUpload } from "./document-upload";

export async function generateMetadata({ params }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  const { supabase, company } = await requireCompany();
  const { data } = await supabase
    .from("lease_tenant")
    .select("contact(first_name, last_name, business_name)")
    .eq("lease_id", id)
    .eq("company_id", company.id)
    .eq("is_primary", true)
    .maybeSingle();
  return { title: contactName(data?.contact) || "Lease" };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2">
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function LeasePage({ params, searchParams }: PageProps<"/tenants/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select(
      "*, unit(id, label, kind, beds, baths, sqft, amenities, access_notes, property(id, name)), lease_tenant(is_primary, role, contact(id, kind, first_name, last_name, business_name, email, mobile, phone, preferred_contact, tags, portal_profile_id, sms_opt_in, sms_opt_in_at, sms_opt_out_at, emergency_contact(id, name, relationship, phone, tenant_contact_id), vehicle(id, make_model, color, tag_number, tag_state, parking_permit_number, tenant_contact_id))), recurring_charge(id, description, amount_cents), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at), pet(id, kind, name, weight_lbs, is_assistance_animal, notes), renters_insurance(id, carrier, policy_number, expires_on, status, liability_cents, company_is_interested_party, tenant_contact_id)",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();

  const today = todayIn(company.time_zone);
  const rules = readBusinessRules(company.settings);
  const people = [...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const primary = people[0]?.contact;
  const timing = leaseTiming(l, today);
  const lateFee = lateFeeText(l, rules);
  const recurring = l.recurring_charge ?? [];
  const monthly = l.rent_cents + recurring.reduce((s, c) => s + c.amount_cents, 0);
  const canEdit = ["admin", "property_manager", "leasing_agent"].includes(membership.role);
  const commercial = l.unit.kind === "commercial";
  const insurance = l.renters_insurance ?? [];
  const vehicles = people.flatMap((p) => p.contact.vehicle);
  const ledger = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of });
  const [{ data: moveOut }, { data: autopay }] = await Promise.all([
    supabase.from("move_out").select("refund_cents, closed_at").eq("lease_id", l.id).maybeSingle(),
    supabase.from("autopay").select("bank_label, day_of_month, last_result").eq("lease_id", l.id).eq("active", true).maybeSingle(),
  ]);
  const deposits = depositHeldCents(l.payment, moveOut?.closed_at ? moveOut.refund_cents : 0);
  const showAll = sp.ledger === "all";
  const ledgerRows = [...ledger.rows].reverse().slice(0, showAll ? undefined : 12);
  const canPost = ["admin", "property_manager", "accountant", "leasing_agent"].includes(membership.role);
  const tenantContacts = people.filter((p) => p.role === "tenant").map((p) => p.contact);
  const { data: messages } = await supabase
    .from("message")
    .select("id, direction, body, sender_name, sender_title, created_at, contact_id")
    .eq("company_id", company.id)
    .in("contact_id", tenantContacts.map((c) => c.id))
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: documents } = await supabase.from("document").select("id, file_name, storage_path, category, created_at").eq("company_id", company.id).eq("lease_id", l.id).order("created_at", { ascending: false }).limit(50);
  const docs = documents ?? [];
  const docLinks = new Map<string, string>();
  if (docs.length) {
    const { data: signed } = await createAdminClient().storage.from("documents").createSignedUrls(docs.map((d) => d.storage_path), 600);
    for (const x of signed ?? []) if (x.path && x.signedUrl) docLinks.set(x.path, x.signedUrl);
  }

  return (
    <>
      <p className="mb-2 text-[13px]">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader
        title={contactName(primary) || "Lease"}
        subtitle={`${l.unit.property.name} · ${l.unit.label}${people.length > 1 ? ` · with ${people.slice(1).map((p) => contactName(p.contact)).join(", ")}` : ""}`}
        action={<Pill tone={timing.tone}>{timing.label}</Pill>}
      />

      {sp.added && (
        <div className="mb-4">
          <Notice tone="success">Lease created. Review the lease document, then mark it signed when everyone has signed.</Notice>
        </div>
      )}
      {sp.blocked && (
        <div className="mb-4">
          <Notice tone="danger">This unit still has another active lease. End it (or put that tenant on notice) before activating this one.</Notice>
        </div>
      )}
      {l.status === "draft" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface-muted px-4 py-3">
          <p className="mr-auto text-sm">
            <span className="font-semibold">Draft lease.</span> Nothing bills until it&apos;s signed.{" "}
            <Link href={`/tenants/${l.id}/lease`} className="font-semibold text-accent hover:underline">
              View the lease document
            </Link>
          </p>
          {canEdit && (
            <form action={markLeaseSigned}>
              <input type="hidden" name="lease_id" value={l.id} />
              <button type="submit" className="min-h-9 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover">
                Mark as signed
              </button>
            </form>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={ledger.balanceCents < 0 ? "Credit" : "Owes"} value={<span className={ledger.balanceCents > 0 ? "text-danger" : undefined}>{money(Math.abs(ledger.balanceCents))}</span>} note={ledger.rows.length ? `${ledger.rows.length} ledger entries` : undefined} />
        <StatTile label="Monthly total" value={money(monthly)} note={`Rent ${money(l.rent_cents)}${recurring.length ? ` + ${money(monthly - l.rent_cents)} other` : ""}`} />
        <StatTile label="Deposit held" value={money(l.deposit_cents)} note={l.deposit_pending_cents ? `${money(l.deposit_pending_cents)} pending` : commercial ? "Commercial lease" : "Fla. Stat. 83.49 applies"} />
        <StatTile label={l.status === "notice" ? "Moving out" : "Lease ends"} value={<span className="text-xl">{l.status === "notice" ? date(l.move_out_on) : l.end_date ? date(l.end_date) : "Month-to-month"}</span>} note={`Started ${date(l.start_date)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Lease terms" description={commercial ? "Commercial lease (Fla. Stat. ch. 83, Part I)." : "Residential lease (Fla. Stat. ch. 83, Part II)."} />
            <dl className="divide-y divide-line px-5 py-2 text-sm">
              <Row label="Unit">
                <Link href={`/properties/${l.unit.property.id}`} className="font-semibold text-accent hover:underline">
                  {l.unit.property.name}
                </Link>{" "}
                · {l.unit.label}
                {!commercial && <span className="text-subtle"> · {bedBath(l.unit.beds, l.unit.baths)}</span>}
                {l.unit.sqft && <span className="text-subtle"> · {l.unit.sqft.toLocaleString()} sq ft</span>}
              </Row>
              <Row label="Term">
                {date(l.start_date)} to {l.end_date ? date(l.end_date) : "month-to-month"}
                {l.term_months && <span className="text-subtle"> ({l.term_months} months)</span>}
              </Row>
              {l.move_in_on && <Row label="Moved in">{date(l.move_in_on)}</Row>}
              <Row label="Rent">{money(l.rent_cents)} a month</Row>
              {recurring.map((c) => (
                <Row key={c.id} label="Also monthly">
                  {money(c.amount_cents)} <span className="text-subtle">{c.description}</span>
                </Row>
              ))}
              <Row label="Deposit">
                {money(l.deposit_cents)} held
                {l.deposit_pending_cents > 0 && `, ${money(l.deposit_pending_cents)} pending`}
              </Row>
              {l.commercial_lease_type && <Row label="Lease type">{l.commercial_lease_type}</Row>}
              {l.unit.amenities.length > 0 && <Row label="Amenities">{l.unit.amenities.join(", ")}</Row>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Automatic billing" description="What the system charges and sends on its own each month." />
            <dl className="divide-y divide-line px-5 py-2 text-sm">
              <Row label="Late fee policy">
                {lateFee.text}{" "}
                <span className="text-subtle">{lateFee.source === "lease" ? "(custom for this tenant)" : "(company default)"}</span>
              </Row>
              <Row label="Returned payment">{l.nsf_fee_cents != null ? `${money(l.nsf_fee_cents)} fee` : <span className="text-subtle">No fee charged</span>}</Row>
              <Row label="Accepts">
                {l.certified_funds_only ? (
                  <>
                    <Pill tone="warn">Certified funds only</Pill> <span className="text-subtle">money order or cashier&apos;s check</span>
                  </>
                ) : (
                  "All payment methods"
                )}
              </Row>
              <Row label="Rent reminders">{l.rent_reminders ? "On" : "Off"}</Row>
              {l.next_rent_increase_on && (
                <Row label="Next increase">
                  {l.next_rent_cents ? `${money(l.next_rent_cents)} from ` : "Due "}
                  {date(l.next_rent_increase_on)}
                </Row>
              )}
            </dl>
            {canEdit && (
              <details className="border-t border-line px-5 py-4">
                <summary className="cursor-pointer text-[13px] font-semibold text-accent">Edit billing settings</summary>
                <div className="mt-3">
                  <BillingSettingsForm
                    leaseId={l.id}
                    companyDefault={`${lateFeeText({ late_fee_grace_days: null, late_fee_flat_cents: null, late_fee_pct: null }, rules).text} (from Settings)`}
                    canEdit={canEdit}
                    terms={{
                      late_fee_grace_days: l.late_fee_grace_days,
                      late_fee_flat_cents: l.late_fee_flat_cents,
                      late_fee_pct: l.late_fee_pct == null ? null : Number(l.late_fee_pct),
                      late_fee_basis: l.late_fee_basis,
                      late_fee_daily_cents: l.late_fee_daily_cents,
                      late_fee_daily_max_cents: l.late_fee_daily_max_cents,
                      nsf_fee_cents: l.nsf_fee_cents,
                      certified_funds_only: l.certified_funds_only,
                      rent_reminders: l.rent_reminders,
                      next_rent_increase_on: l.next_rent_increase_on,
                      next_rent_cents: l.next_rent_cents,
                    }}
                  />
                </div>
              </details>
            )}
          </Card>

          <Card>
            <CardHeader title="People on this lease" description="Contact details for everyone on the lease." />
            <div className="divide-y divide-line">
              {people.map(({ contact: c, is_primary, role }) => (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{contactName(c)}</p>
                    {is_primary && <Pill tone="info">Primary</Pill>}
                    {role === "guarantor" && <Pill tone="warn">Co-signer</Pill>}
                    {role === "occupant" && <Pill>Occupant</Pill>}
                    {c.kind === "business" && <Pill>Business</Pill>}
                    {c.tags.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {[c.mobile && `Mobile ${c.mobile}`, c.phone && `Phone ${c.phone}`, c.email].filter(Boolean).join(" · ") || (
                      <span className="font-semibold text-warn">No phone or email on file</span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                    {smsStatus(c) === "opted_in" ? (
                      <>
                        <Pill tone="success">Texts on</Pill>
                        <span className="text-subtle">agreed {c.sms_opt_in_at ? date(c.sms_opt_in_at.slice(0, 10)) : ""} in the portal</span>
                        {canEdit && (
                          <form action={stopTexts}>
                            <input type="hidden" name="contact_id" value={c.id} />
                            <input type="hidden" name="lease_id" value={l.id} />
                            <button type="submit" className="min-h-10 px-1 font-semibold text-danger hover:underline">
                              They asked to stop texts
                            </button>
                          </form>
                        )}
                      </>
                    ) : smsStatus(c) === "opted_out" ? (
                      <span className="text-subtle">Texts off (stopped {c.sms_opt_out_at ? date(c.sms_opt_out_at.slice(0, 10)) : ""}). Only they can turn texts back on, in the portal.</span>
                    ) : (
                      <span className="text-subtle">No texts: they haven&apos;t agreed. They can turn texts on in the portal (My lease).</span>
                    )}
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[13px] font-semibold text-accent">Edit contact details</summary>
                    <div className="mt-3">
                      <TenantContactForm
                        leaseId={l.id}
                        canEdit={canEdit}
                        contact={{ id: c.id, kind: c.kind, first_name: c.first_name, last_name: c.last_name, business_name: c.business_name, email: c.email, mobile: c.mobile, phone: c.phone, preferred_contact: c.preferred_contact }}
                      />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="Ledger"
              description={`Balance ${money(ledger.balanceCents)}${deposits ? ` · ${money(deposits)} deposit held in trust` : ""}${autopay ? ` · Autopay on day ${autopay.day_of_month} from ${autopay.bank_label}${autopay.last_result ? ` (last: ${autopay.last_result})` : ""}` : ""}`}
              action={<Link href={`/tenants/${l.id}/ledger.csv`} className="text-[13px] font-semibold text-accent hover:underline">Export CSV</Link>}
            />
            {ledgerRows.length ? (
              <Table minWidth={460}>
                <Thead>
                  <Th>Date</Th>
                  <Th>Item</Th>
                  <Th right>Amount</Th>
                  <Th right>Balance</Th>
                </Thead>
                <Tbody>
                  {ledgerRows.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-[13px]">{date(r.date)}</Td>
                      <Td className="text-[13px]">
                        {r.description}
                        {r.kind === "payment" && r.status === "succeeded" && canPost && (
                          <div>
                            <ReturnPaymentButton paymentId={r.id} today={today} fee={l.nsf_fee_cents ? money(l.nsf_fee_cents) : null} />
                          </div>
                        )}
                        {r.status === "returned" && r.kind === "payment" && <p className="text-[12px] text-danger">Returned</p>}
                      </Td>
                      <Td right className={`text-[13px] ${r.paymentCents ? "text-accent" : ""}`}>{r.paymentCents ? `−${money(r.paymentCents)}` : money(r.chargeCents)}</Td>
                      <Td right className="text-[13px] font-semibold">{money(r.balanceCents)}</Td>
                    </tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <EmptyState title="Nothing on the ledger yet">Rent posts automatically each month once automatic billing is on (Settings → Billing).</EmptyState>
            )}
            {ledger.rows.length > 12 && (
              <p className="border-t border-line px-5 py-2 text-[13px]">
                <Link href={`/tenants/${l.id}${showAll ? "" : "?ledger=all"}`} className="font-semibold text-accent hover:underline">
                  {showAll ? "Show recent only" : `Show all ${ledger.rows.length}`}
                </Link>
              </p>
            )}
            {canPost && (
              <div className="space-y-3 border-t border-line px-5 py-4">
                <details>
                  <summary className="cursor-pointer text-[13px] font-semibold text-accent">+ Record a payment</summary>
                  <div className="mt-3">
                    <PaymentForm leaseId={l.id} today={today} certifiedOnly={l.certified_funds_only} />
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer text-[13px] font-semibold text-accent">+ Add a charge</summary>
                  <div className="mt-3">
                    <ChargeForm leaseId={l.id} today={today} />
                  </div>
                </details>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Tenant portal" description="Tenants sign in with their e-mail to pay, request repairs and message you." />
            <ul className="divide-y divide-line">
              {tenantContacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[14px]">
                  <span>
                    <span className="font-semibold">{contactName(c)}</span>
                    <span className="block text-[12px] text-subtle">{c.portal_profile_id ? "Using the portal" : c.email ? c.email : "No e-mail on file"}</span>
                  </span>
                  {c.email && canEdit && <InviteButton contactId={c.id} label={c.portal_profile_id ? "Re-send link" : "Send portal invite"} />}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Messages" description="Portal messages with this household, newest first." />
            <div className="space-y-2 px-5 py-4">
              {messages?.length ? (
                messages.map((m) => (
                  <div key={m.id} className={`rounded-[12px] px-3 py-2 text-[14px] ${m.direction === "inbound" ? "bg-surface-muted" : "bg-accent-softer"}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-[12px] text-subtle">
                      {m.direction === "inbound" ? contactName(tenantContacts.find((c) => c.id === m.contact_id)) : [m.sender_name, m.sender_title].filter(Boolean).join(", ")} · {date(m.created_at.slice(0, 10))}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-subtle">No messages yet.</p>
              )}
              {tenantContacts[0] && canEdit && <ReplyForm contactId={(messages?.find((m) => m.direction === "inbound")?.contact_id ?? tenantContacts[0].id) as string} leaseId={l.id} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Notes and access" />
            <LeaseNotesForm leaseId={l.id} unitId={l.unit.id} notes={l.notes} accessNotes={l.unit.access_notes} canEdit={canEdit} />
          </Card>
          <HouseholdCard
            leaseId={l.id}
            people={people.map((p) => ({ id: p.contact.id, name: contactName(p.contact) }))}
            insurance={insurance}
            vehicles={vehicles}
            pets={l.pet}
            emergency={people.flatMap((p) => p.contact.emergency_contact)}
            commercial={commercial}
            canEdit={canEdit}
          />
          <Card>
            <CardHeader
              title="Documents"
              description="Filed letters and notices, insurance, photos and the lease."
              action={
                <span className="flex gap-3">
                  <Link href={`/communications/new?lease=${l.id}&template=rent-reminder`} className="text-[13px] font-semibold text-accent hover:underline">
                    Send a letter
                  </Link>
                  <Link href={`/tenants/${l.id}/move-out`} className="text-[13px] font-semibold text-accent hover:underline">
                    Move-out
                  </Link>
                  <Link href={`/tenants/${l.id}/lease`} className="text-[13px] font-semibold text-accent hover:underline">
                    Lease document
                  </Link>
                </span>
              }
            />
            {docs.length ? (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                    {docLinks.get(d.storage_path) ? (
                      <a href={docLinks.get(d.storage_path)} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                        {d.file_name}
                      </a>
                    ) : (
                      <span>{d.file_name}</span>
                    )}
                    <span className="shrink-0 text-subtle">
                      {DOCUMENT_CATEGORIES[d.category as keyof typeof DOCUMENT_CATEGORIES] ?? "Other"} · {date(d.created_at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No documents yet">Letters you send, insurance the tenant uploads and request photos are filed here.</EmptyState>
            )}
            {canEdit && <TenantDocumentUpload leaseId={l.id} />}
          </Card>
        </div>
      </div>
    </>
  );
}
