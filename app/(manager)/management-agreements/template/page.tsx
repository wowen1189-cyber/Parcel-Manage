import Link from "next/link";
import { DocumentView } from "@/components/document-view";
import { Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Management agreement template" };

// The template with sample values and every optional clause shown; each agreement includes only what applies.
export default async function ManagementAgreementTemplatePage() {
  await requireCompany();
  const t = MANAGEMENT_AGREEMENT;
  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/management-agreements" className="font-semibold text-accent hover:underline">
          ← Management agreements
        </Link>
      </p>
      <PageHeader title="Management agreement template" subtitle="Your agreement rebuilt for Florida law. Sample values are shown; each agreement fills in from the owner, their properties and their fees." action={<PrintButton />} />
      <Card className="px-6 py-8 sm:px-10 print:border-0 print:p-0">
        <DocumentView
          template={t}
          values={Object.fromEntries(Object.entries(t.fields).map(([k, fd]) => [k, fd.example]))}
          conditions={new Set(["pma_leasing", "pma_evictions", "pma_contractors", "pma_disbursements", "pma_auto_renew"])}
          parties={{}}
        />
      </Card>
    </>
  );
}
