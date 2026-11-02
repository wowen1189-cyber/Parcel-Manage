import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { Button, Card, CardHeader, Notice, PageHeader, Pill } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { date } from "@/lib/format";
import { AGREEMENT_STATUS } from "@/lib/management-agreement";
import { loadAgreement } from "@/lib/management-agreement-data";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDraftAgreement, voidAgreementRequest } from "../actions";
import { AgreementForm, EndAgreement, SendAgreement } from "../forms";

export const metadata = { title: "Management agreement" };

export default async function ManagementAgreementPage({ params }: PageProps<"/management-agreements/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const found = await loadAgreement(supabase, company, id);
  if (!found) notFound();
  const { agreement: a, terms, template, values, conditions, missing, requests } = found;
  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const status = AGREEMENT_STATUS[a.status];
  const day = (ts: string | null | undefined) => (ts ? date(new Date(ts).toLocaleDateString("en-CA", { timeZone: company.time_zone })) : "");
  const open = requests.find((r) => r.status === "sent");
  const done = requests.find((r) => r.status === "completed");
  let signedUrl: string | null = null;
  if (done?.signed_document_id) {
    const { data: doc } = await supabase.from("document").select("storage_path").eq("id", done.signed_document_id).maybeSingle();
    if (doc) signedUrl = (await createAdminClient().storage.from("documents").createSignedUrl(doc.storage_path, 600)).data?.signedUrl ?? null;
  }

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/management-agreements" className="font-semibold text-accent hover:underline">
          ← Management agreements
        </Link>
      </p>
      <PageHeader
        title={a.entity.name}
        subtitle={`Property management agreement · ${date(a.start_date)} – ${date(a.end_date)} · ${found.properties.length} ${found.properties.length === 1 ? "property" : "properties"}`}
        action={<Pill tone={status.tone}>{status.label}</Pill>}
      />

      <div className="space-y-6 print:hidden">
        {a.status === "draft" && missing.length > 0 && <Notice tone="warn">Before sending, add {missing.join("; ")}.</Notice>}

        {(open || done) && (
          <Card className="overflow-hidden">
            <CardHeader title="Signatures" description={done ? `Signed by everyone ${day(done.completed_at)}. The signed copy is filed on the owner.` : "The owner signs first, then you."} />
            <ul className="divide-y divide-line">
              {[...(done ?? open)!.signature_signer]
                .sort((x, y) => x.sign_order - y.sign_order)
                .map((s) => (
                  <li key={s.email + s.sign_order} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{s.name}</span> <span className="text-subtle">· {s.role === "owner" ? "Owner" : "Broker"} · {s.email}</span>
                    </span>
                    <Pill tone={s.status === "signed" ? "success" : s.status === "declined" ? "danger" : s.status === "viewed" ? "info" : "neutral"}>{s.status === "signed" ? `Signed ${day(s.signed_at)}` : s.status === "waiting" ? "Waiting" : s.status === "sent" ? "Sent" : s.status === "viewed" ? "Opened" : "Declined"}</Pill>
                  </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-3 border-t border-line px-5 py-4">
              {signedUrl && (
                <a href={signedUrl} className="min-h-11 rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-semibold text-white">
                  Download the signed copy
                </a>
              )}
              {open && canEdit && (
                <form action={voidAgreementRequest}>
                  <input type="hidden" name="request_id" value={open.id} />
                  <Button type="submit" variant="secondary">
                    Void and edit
                  </Button>
                </form>
              )}
            </div>
          </Card>
        )}

        {a.status === "draft" && (
          <Card>
            <CardHeader title="Terms" description="Fees come from this owner's fees in Parcel Manage (change them on the owner's page). Save, check the agreement below, then send it." />
            <AgreementForm
              id={a.id}
              terms={terms}
              startDate={a.start_date}
              signer={{ name: a.owner_signer_name, title: a.owner_signer_title, email: a.owner_signer_email }}
              ownerEmail={a.entity.email}
              properties={found.allProperties}
              included={a.property_ids}
              canEdit={canEdit}
            />
            {canEdit && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
                <SendAgreement id={a.id} />
                {!requests.length && (
                  <form action={deleteDraftAgreement}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="ghost">
                      Delete draft
                    </Button>
                  </form>
                )}
              </div>
            )}
          </Card>
        )}

        {a.status === "signed" && canEdit && (
          <Card>
            <CardHeader title="End this agreement" description={`Either side can end it with ${terms.noticeDays} days' written notice. When it ends, deposits move to the owner or new agent with an accounting (Fla. Stat. 83.49(7)).`} />
            <div className="p-5">
              <EndAgreement id={a.id} />
            </div>
          </Card>
        )}
        {a.status === "ended" && <Notice tone="info">This agreement ended {date(a.ended_on)}. Start a new one from Management agreements.</Notice>}
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold">The agreement</h2>
        <PrintButton />
      </div>
      <Card className="px-6 py-8 sm:px-10 print:border-0 print:p-0">
        <DocumentView template={template} values={values} conditions={conditions} parties={{ owner: [values.owner_signer || a.entity.name], agent: [values.agent_name] }} />
      </Card>
    </>
  );
}
