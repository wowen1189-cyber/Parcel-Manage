import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readBusinessRules } from "@/lib/business-rules";
import { readCommercialTerms } from "@/lib/commercial-terms";
import { COMMERCIAL_TEMPLATES, TEMPLATES } from "@/lib/documents";
import { fillCommercialLease, fillLease, type CompanyForDocument } from "@/lib/documents/fill";
import { usedFields } from "@/lib/documents/text";
import type { DocumentTemplate } from "@/lib/documents/types";
import { readLeaseSettings } from "@/lib/property-lease-settings";
import type { Database } from "@/lib/supabase/database.types";

// The documents for one lease, filled in: the residential lease and its Florida disclosures (lead paint only
// for homes built before 1978), or the commercial lease. Shared by the lease page and e-signature.

type Db = SupabaseClient<Database>;

export async function leaseDocuments(supabase: Db, company: CompanyForDocument & { id: string; settings: unknown }, leaseId: string) {
  const { data: l } = await supabase
    .from("lease")
    .select(
      "id, status, start_date, end_date, term_months, rent_cents, deposit_cents, commercial_terms, created_at, unit(label, kind, sqft, property_id, property(name, property_type, address_line1, address_line2, city, state, postal_code, year_built, lease_settings, unit(id), entity(name))), lease_tenant(role, is_primary, contact(id, kind, first_name, last_name, business_name, email, mobile)), pet(kind, name, is_assistance_animal), recurring_charge(description, amount_cents)",
    )
    .eq("id", leaseId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) return null;
  const commercial = l.unit.kind === "commercial";
  const settings = readLeaseSettings(l.unit.property.lease_settings, l.unit.property.property_type, l.unit.property.unit.length);
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
  const pre1978 = l.unit.property.year_built != null && l.unit.property.year_built < 1978;
  const templates: DocumentTemplate[] = commercial ? COMMERCIAL_TEMPLATES : TEMPLATES.filter((t) => t.id !== "lead-paint-disclosure" || pre1978);
  const docs = templates.map((template) => {
    const filled = commercial
      ? { ...fillCommercialLease(template, { ...forDoc, sqft: l.unit.sqft, createdAt: l.created_at }, company, readCommercialTerms(l.commercial_terms), settings), yearBuiltUnknown: false }
      : { ...fillLease(template, forDoc, company, readBusinessRules(company.settings), settings), schedule: [] };
    const blanks = usedFields(template, filled.conditions)
      .filter((k) => !filled.values[k])
      .map((k) => template.fields[k]?.label ?? k);
    return { template, ...filled, blanks };
  });
  return { lease: l, commercial, docs, pre1978 };
}
