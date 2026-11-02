import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader, Pill } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead } from "@/components/table";
import { contactName, date } from "@/lib/format";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { voidEsign } from "./actions";
import { SendDocumentForm } from "./send-form";

export const metadata = { title: "E-sign" };

const STATUS = { sent: { label: "Out for signature", tone: "info" }, completed: { label: "Signed", tone: "success" }, voided: { label: "Voided", tone: "neutral" } } as const;

// Every signature request (leases, management agreements and uploaded PDFs) and "Send a document".
export default async function EsignPage() {
  const { supabase, company, membership } = await requireCompany();
  const canSend = ["admin", "property_manager", "leasing_agent", "accountant"].includes(membership.role);
  const [{ data: requests }, { data: leases }] = await Promise.all([
    supabase
      .from("signature_request")
      .select("id, title, status, created_at, completed_at, lease_id, management_agreement_id, source_path, signed_document_id, document:signed_document_id(storage_path), signature_signer(name, status, sign_order)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("lease")
      .select("id, unit(label, property(name)), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name, email))")
      .eq("company_id", company.id)
      .in("status", ["active", "notice", "draft", "pending_signature"]),
  ]);
  const paths = (requests ?? []).flatMap((r) => (r.document?.storage_path ? [r.document.storage_path] : []));
  const signed = paths.length ? (await createAdminClient().storage.from("documents").createSignedUrls(paths, 600)).data ?? [] : [];
  const link = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const leaseOptions = (leases ?? [])
    .map((l) => {
      const people = [...l.lease_tenant].filter((t) => t.role !== "occupant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      return {
        id: l.id,
        label: `${contactName(people[0]?.contact) || "Tenant"} · ${l.unit.property.name}${l.unit.label !== "Home" ? ` ${l.unit.label}` : ""}`,
        signers: people.filter((p) => p.contact.email).map((p) => ({ name: contactName(p.contact), email: p.contact.email!.split(/[,;]/)[0].trim() })),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const kind = (r: { lease_id: string | null; management_agreement_id: string | null; source_path: string | null }) => (r.source_path ? "Document" : r.management_agreement_id ? "Management agreement" : "Lease");
  const openHref = (r: { lease_id: string | null; management_agreement_id: string | null; source_path: string | null }) => (r.management_agreement_id ? `/management-agreements/${r.management_agreement_id}` : r.lease_id ? `/tenants/${r.lease_id}` : null);

  return (
    <>
      <PageHeader title="E-sign" subtitle="Send any PDF for signature and see everything out for signature. Signed copies carry a certificate with each signer's consent, time, IP address and device (Fla. Stat. ch. 668; E-SIGN Act)." />
      <div className="space-y-6">
        {canSend && (
          <Card>
            <CardHeader title="Send a document" description="Upload a PDF, add the signers in order, and send. Leases and management agreements are sent from their own pages." />
            <SendDocumentForm leases={leaseOptions} />
          </Card>
        )}
        <Card className="overflow-hidden">
          <CardHeader title="Signature requests" />
          {requests?.length ? (
            <Table minWidth={820}>
              <Thead>
                <Th>Document</Th>
                <Th>Signers</Th>
                <Th>Sent</Th>
                <Th>Status</Th>
                <Th />
              </Thead>
              <Tbody>
                {requests.map((r) => {
                  const status = STATUS[r.status as keyof typeof STATUS] ?? STATUS.sent;
                  const href = openHref(r);
                  const url = r.document?.storage_path ? link.get(r.document.storage_path) : undefined;
                  return (
                    <tr key={r.id}>
                      <Td>
                        {href ? (
                          <Link href={href} className="font-semibold text-accent hover:underline">
                            {r.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{r.title}</span>
                        )}
                        <p className="text-[13px] text-subtle">{kind(r)}</p>
                      </Td>
                      <Td className="text-[13px]">
                        {[...r.signature_signer]
                          .sort((a, b) => a.sign_order - b.sign_order)
                          .map((s) => `${s.name}${s.status === "signed" ? " ✓" : s.status === "declined" ? " (declined)" : ""}`)
                          .join(", ")}
                      </Td>
                      <Td className="whitespace-nowrap text-[13px]">{date(r.created_at.slice(0, 10))}</Td>
                      <Td>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </Td>
                      <Td right>
                        {url ? (
                          <a href={url} className="text-[13px] font-semibold text-accent hover:underline">
                            Signed copy
                          </a>
                        ) : r.status === "sent" && r.source_path && canSend ? (
                          <form action={voidEsign}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="min-h-10 text-[13px] font-semibold text-danger">Void</button>
                          </form>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </Tbody>
            </Table>
          ) : (
            <EmptyState title="Nothing sent for signature yet" />
          )}
        </Card>
      </div>
    </>
  );
}
