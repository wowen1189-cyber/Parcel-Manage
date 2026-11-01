import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { param } from "@/components/list-filters";
import { readBusinessRules } from "@/lib/business-rules";
import { TEMPLATES } from "@/lib/documents";
import { fillLease } from "@/lib/documents/fill";
import { contactName } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Lease document" };

// A lease document filled in from this tenancy, with signature, initial and date areas.
// Blanks still to decide (owning LLC, deposit bank) show highlighted. E-signing comes with the E-sign module.
export default async function LeaseDocumentPage({ params, searchParams }: PageProps<"/tenants/[id]/lease">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select(
      "start_date, end_date, term_months, rent_cents, deposit_cents, unit(label, kind, property(name, property_type, address_line1, address_line2, city, state, postal_code, year_built, entity(name))), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name, email)), pet(kind, name, is_assistance_animal), recurring_charge(description, amount_cents)",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();

  const doc = TEMPLATES.find((t) => t.id === param(sp, "doc")) ?? TEMPLATES[0];
  const showChanges = param(sp, "changes") === "1";
  const { values, conditions, parties, yearBuiltUnknown } = fillLease(
    doc,
    {
      start_date: l.start_date,
      end_date: l.end_date,
      term_months: l.term_months,
      rent_cents: l.rent_cents,
      deposit_cents: l.deposit_cents,
      unitLabel: l.unit.label,
      unitKind: l.unit.kind,
      property: { ...l.unit.property, entityName: l.unit.property.entity?.name ?? null },
      people: l.lease_tenant,
      pets: l.pet,
      recurring: l.recurring_charge,
    },
    company,
    readBusinessRules(company.settings),
  );
  const blanks = Object.entries(values).filter(([k, v]) => !v && JSON.stringify(doc.sections).includes(`{{${k}}}`)).length;
  const primary = [...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  const commercial = l.unit.kind === "commercial";
  const docs = TEMPLATES.filter((t) => t.id !== "lead-paint-disclosure" || conditions.has("pre_1978") || yearBuiltUnknown);

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href={`/tenants/${id}`} className="font-semibold text-accent hover:underline">
          ← {contactName(primary?.contact) || "Lease"}
        </Link>
      </p>
      <PageHeader title={doc.title} subtitle={`${l.unit.property.name} · ${l.unit.label}`} action={<PrintButton />} />
      {commercial && <Notice tone="warn">This is a commercial unit. The residential lease and Florida residential disclosures don&apos;t apply; a commercial lease template comes later.</Notice>}
      <div className="my-4 flex flex-wrap gap-2 print:hidden">
        {docs.map((t) => (
          <Link key={t.id} href={`/tenants/${id}/lease?doc=${t.id}${showChanges ? "&changes=1" : ""}`} className={buttonClass(t.id === doc.id ? "primary" : "secondary", true)}>
            {t.title}
          </Link>
        ))}
        <Link href={`/tenants/${id}/lease?doc=${doc.id}${showChanges ? "" : "&changes=1"}`} className={buttonClass("ghost", true)}>
          {showChanges ? "Hide changes" : "Show what changed for Florida law"}
        </Link>
      </div>
      {blanks > 0 && (
        <div className="mb-4 print:hidden">
          <Notice tone="warn">
            {blanks} blank{blanks === 1 ? "" : "s"} still to fill (highlighted), like the owning LLC and the bank holding deposits. See the questions on the{" "}
            <Link href="/tenants/lease-template" className="font-semibold underline">
              lease template page
            </Link>
            .
          </Notice>
        </div>
      )}
      {yearBuiltUnknown && doc.id === "lead-paint-disclosure" && (
        <div className="mb-4 print:hidden">
          <Notice>This property&apos;s year built isn&apos;t set. The lead paint disclosure is only needed for homes built before 1978; add the year on the property page.</Notice>
        </div>
      )}
      <Card className="mx-auto max-w-[860px] px-6 py-8 sm:px-12 print:max-w-none print:border-0 print:p-0">
        <DocumentView template={doc} values={values} conditions={conditions} parties={parties} showChanges={showChanges} />
      </Card>
    </>
  );
}
