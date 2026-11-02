import Link from "next/link";
import { DocumentView } from "@/components/document-view";
import { Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { sampleAgreementValues } from "@/lib/management-agreement";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Management agreement template" };

// Parcel Manage's Florida agreement filled with this company's details, default terms and default fee, a
// sample owner, and every optional clause shown; each agreement includes only what applies.
export default async function ManagementAgreementTemplatePage() {
  const { company } = await requireCompany();
  const values = sampleAgreementValues(company, new Date().toLocaleDateString("en-CA", { timeZone: company.time_zone }));
  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/management-agreements/templates" className="font-semibold text-accent hover:underline">
          ← Agreement templates
        </Link>
      </p>
      <PageHeader
        title="Parcel Manage's Florida agreement"
        subtitle="Built for Florida law, with your company's details, default terms and default fee, and a sample owner. Each agreement fills in from the owner, their properties and each property's fees. To change the wording, make your own copy under Templates."
        action={<PrintButton />}
      />
      <Card className="px-6 py-8 sm:px-10 print:border-0 print:p-0">
        <DocumentView template={MANAGEMENT_AGREEMENT} values={values} conditions={new Set(["pma_leasing", "pma_evictions", "pma_contractors", "pma_disbursements", "pma_auto_renew"])} parties={{}} />
      </Card>
    </>
  );
}
