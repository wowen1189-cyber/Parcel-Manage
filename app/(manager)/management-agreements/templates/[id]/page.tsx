import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { FIELDS, partsToTemplate, readParts } from "@/lib/agreement-templates";
import { sampleAgreementValues } from "@/lib/management-agreement";
import { requireCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteTemplate } from "../actions";
import { TemplateEditor } from "../editor";

export const metadata = { title: "Agreement template" };

export default async function AgreementTemplatePage({ params }: PageProps<"/management-agreements/templates/[id]">) {
  const { id } = await params;
  const { supabase, company, membership } = await requireCompany();
  const { data: t } = await supabase.from("agreement_template").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!t) notFound();
  const canEdit = ["admin", "property_manager"].includes(membership.role);
  const parts = readParts(t.parts);
  const original = t.source_path ? (await createAdminClient().storage.from("documents").createSignedUrl(t.source_path, 600)).data?.signedUrl : null;
  const values = sampleAgreementValues(company, new Date().toLocaleDateString("en-CA", { timeZone: company.time_zone }));

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/management-agreements/templates" className="font-semibold text-accent hover:underline">
          ← Agreement templates
        </Link>
      </p>
      <PageHeader
        title={t.name}
        subtitle="Your own management agreement. Have your attorney review it: Parcel Manage's Florida-law checks cover only its built-in agreement."
        action={
          original ? (
            <a href={original} className="font-semibold text-accent hover:underline">
              Download your original ({t.source_name})
            </a>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="print:hidden">
          <TemplateEditor id={t.id} name={t.name} parts={parts} fields={Object.entries(FIELDS).map(([key, f]) => ({ key, label: f.label }))} canEdit={canEdit} />
          {canEdit && (
            <form action={deleteTemplate} className="mt-6">
              <input type="hidden" name="id" value={t.id} />
              <Button type="submit" variant="ghost">
                Delete this template
              </Button>
            </form>
          )}
        </div>
        <div>
          <Card className="px-6 py-8 sm:px-10 xl:sticky xl:top-4 print:border-0 print:p-0">
            <CardHeader title="Preview (as last saved)" description="Your details, default terms and fee, and a sample owner. Optional parts are all shown." />
            <DocumentView template={partsToTemplate(t.name, parts)} values={values} conditions={new Set(["pma_leasing", "pma_evictions", "pma_contractors", "pma_disbursements", "pma_auto_renew"])} parties={{}} />
          </Card>
        </div>
      </div>
    </>
  );
}
