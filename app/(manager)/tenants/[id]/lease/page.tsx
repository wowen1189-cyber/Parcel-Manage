import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { Card, CardHeader, Notice, PageHeader, Pill, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { param } from "@/components/list-filters";
import { readBusinessRules } from "@/lib/business-rules";
import { COMMERCIAL_TEMPLATES, TEMPLATES } from "@/lib/documents";
import { fillCommercialLease, fillLease } from "@/lib/documents/fill";
import { contactName, date, money } from "@/lib/format";
import { missingCommercialTerms, readCommercialTerms } from "@/lib/commercial-terms";
import { CommercialTermsForm } from "../../commercial-terms";
import { readLeaseSettings } from "@/lib/property-lease-settings";
import { requireCompany } from "@/lib/session";

export const metadata = { title: "Lease document" };

// A lease document filled in from this tenancy, with signature, initial and date areas.
// Blanks still to decide (owning LLC, deposit bank) show highlighted. E-signing comes with the E-sign module.
export default async function LeaseDocumentPage({ params, searchParams }: PageProps<"/tenants/[id]/lease">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, membership } = await requireCompany();
  const { data: l } = await supabase
    .from("lease")
    .select(
      "start_date, end_date, term_months, rent_cents, deposit_cents, commercial_terms, created_at, unit(label, kind, sqft, property_id, property(name, property_type, address_line1, address_line2, city, state, postal_code, year_built, lease_settings, unit(id), entity(name))), lease_tenant(role, is_primary, contact(kind, first_name, last_name, business_name, email, mobile)), pet(kind, name, is_assistance_animal), recurring_charge(description, amount_cents)",
    )
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) notFound();

  const commercial = l.unit.kind === "commercial";
  const settings = readLeaseSettings(l.unit.property.lease_settings, l.unit.property.property_type, l.unit.property.unit.length);
  const terms = readCommercialTerms(l.commercial_terms);
  const forDoc = {
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
  };
  // Lead paint disclosure only for homes built before 1978 (federal rule); never offered when the year is unknown.
  const pre1978 = l.unit.property.year_built != null && l.unit.property.year_built < 1978;
  // Commercial space gets the commercial lease (ch. 83 Part I); residential disclosures don't apply to it.
  const docs = commercial ? COMMERCIAL_TEMPLATES : TEMPLATES.filter((t) => t.id !== "lead-paint-disclosure" || pre1978);
  const doc = docs.find((t) => t.id === param(sp, "doc")) ?? docs[0];
  const filled = commercial
    ? { ...fillCommercialLease(doc, { ...forDoc, sqft: l.unit.sqft, createdAt: l.created_at }, company, terms, settings), yearBuiltUnknown: false }
    : { ...fillLease(doc, forDoc, company, readBusinessRules(company.settings), settings), schedule: [] };
  const { values, conditions, parties, yearBuiltUnknown } = filled;
  const canEdit = ["admin", "property_manager", "leasing_agent"].includes(membership.role);
  const blanks = Object.entries(values).filter(([k, v]) => !v && JSON.stringify(doc.sections).includes(`{{${k}}}`)).length;
  const primary = [...l.lease_tenant].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  const missingTerms = commercial ? missingCommercialTerms(terms) : [];

  return (
    <>
      <p className="mb-2 text-[13px] print:hidden">
        <Link href={`/tenants/${id}`} className="font-semibold text-accent hover:underline">
          ← {contactName(primary?.contact) || "Lease"}
        </Link>
      </p>
      <PageHeader title={doc.title} subtitle={`${l.unit.property.name} · ${l.unit.label}`} action={<PrintButton />} />
      {commercial && (
        <Card className="mb-4 print:hidden">
          <CardHeader
            title="Commercial terms"
            description={filled.schedule.length ? `Base rent: ${filled.schedule.map((r) => `${money(r.monthlyCents)} from ${date(r.from)}`).join(", ")}.` : "The deal terms printed in the lease."}
            action={missingTerms.length ? <Pill tone="warn">Missing: {missingTerms.join(", ")}</Pill> : <Pill tone="success">Complete</Pill>}
          />
          <CommercialTermsForm leaseId={id} terms={terms} canEdit={canEdit} />
        </Card>
      )}
      <div className="my-4 flex flex-wrap gap-2 print:hidden">
        {docs.map((t) => (
          <Link key={t.id} href={`/tenants/${id}/lease?doc=${t.id}`} className={buttonClass(t.id === doc.id ? "primary" : "secondary", true)}>
            {t.title}
          </Link>
        ))}
      </div>
      {blanks > 0 && (
        <div className="mb-4 print:hidden">
          <Notice tone="warn">
            {blanks} blank{blanks === 1 ? "" : "s"} still to fill (highlighted), like where deposits are held. Fill them in on the{" "}
            <Link href={`/properties/${l.unit.property_id}`} className="font-semibold underline">
              property&apos;s lease settings
            </Link>
            .
          </Notice>
        </div>
      )}
      {yearBuiltUnknown && !commercial && (
        <div className="mb-4 print:hidden">
          <Notice>
            This property&apos;s year built isn&apos;t set, so the lead paint disclosure is hidden. It&apos;s required only for homes built before 1978: add the year on the{" "}
            <Link href={`/properties/${l.unit.property_id}`} className="font-semibold underline">
              property page
            </Link>
            .
          </Notice>
        </div>
      )}
      <Card className="mx-auto max-w-[860px] px-6 py-8 sm:px-12 print:max-w-none print:border-0 print:p-0">
        <DocumentView template={doc} values={values} conditions={conditions} parties={parties} />
      </Card>
    </>
  );
}
