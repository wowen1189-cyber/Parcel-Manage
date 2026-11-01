import Link from "next/link";
import { DocumentView } from "@/components/document-view";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { param } from "@/components/list-filters";
import { COMMERCIAL_TEMPLATES, TEMPLATES } from "@/lib/documents";
import type { Condition } from "@/lib/documents/types";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Lease and disclosures" };

// Every condition on, so the whole template (all optional sections) shows.
const ALL: Condition[] = ["single_family", "multi_unit", "has_pets", "pre_1978", "deposit_alternative_offered", "repair_deductible", "tenant_lawn_care", "has_guarantor", "email_notices", "long_term", "resident_pest_control", "irrigation"];

export default async function LeaseTemplatePage({ searchParams }: PageProps<"/tenants/lease-template">) {
  await requireCompany();
  const params = await searchParams;
  const all = [...TEMPLATES, ...COMMERCIAL_TEMPLATES];
  const doc = all.find((t) => t.id === param(params, "doc")) ?? TEMPLATES[0];

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href="/tenants" className="font-semibold text-accent hover:underline">
          ← Tenants & leases
        </Link>
      </p>
      <PageHeader title="Lease and disclosures" subtitle="SIM REI's residential lease, Florida disclosures and commercial lease. Every optional section is shown; each lease includes only what applies." action={<PrintButton />} />

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {all.map((t) => (
          <Link key={t.id} href={`/tenants/lease-template?doc=${t.id}`} className={buttonClass(t.id === doc.id ? "primary" : "secondary", true)}>
            {t.title}
          </Link>
        ))}
      </div>

      <Card className="px-6 py-8 sm:px-10 print:border-0 print:p-0">
        <DocumentView
          template={doc}
          values={Object.fromEntries(Object.entries(doc.fields).filter(([, fd]) => fd.source === "setting" || fd.fixedByLaw).map(([k, fd]) => [k, fd.example]))}
          conditions={new Set(ALL)}
          parties={{}}
        />
      </Card>
    </>
  );
}
