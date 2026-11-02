import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MANAGEMENT_AGREEMENT } from "@/lib/documents/management-agreement";
import { oneLineAddress } from "@/lib/format";
import { brokerLicense, fillAgreement, readAgreementTerms } from "@/lib/management-agreement";
import { effectiveFee, readCompanyFee } from "@/lib/management-fees";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;
type Company = { id: string; name: string; legal_name: string | null; address: string | null; office_email: string | null; settings: unknown; time_zone: string };

/** An agreement with its owner, properties (and the fee each pays) and the filled-in document. */
export async function loadAgreement(db: Db, company: Company, id: string) {
  const { data: a } = await db
    .from("management_agreement")
    .select("*, entity(id, name, email, mailing_address, management_fee, reserve_cents)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!a) return null;
  const { data: props } = await db
    .from("property")
    .select("id, name, address_line1, address_line2, city, state, postal_code, management_fee")
    .eq("company_id", company.id)
    .eq("entity_id", a.entity_id)
    .order("name");
  const companyFee = readCompanyFee(company.settings);
  const all = (props ?? []).map((p) => ({ id: p.id, name: p.name, address: oneLineAddress(p), fee: effectiveFee(p.management_fee, a.entity.management_fee, companyFee).fee }));
  const included = all.filter((p) => a.property_ids.includes(p.id));
  const terms = readAgreementTerms(a.terms);
  const filled = fillAgreement({
    createdOn: new Date(a.created_at).toLocaleDateString("en-CA", { timeZone: company.time_zone }),
    startDate: a.start_date,
    endDate: a.end_date,
    terms,
    owner: a.entity,
    signer: { name: a.owner_signer_name, title: a.owner_signer_title },
    company: { ...company, broker_license: brokerLicense(company.settings) },
    properties: included,
  });
  if (!a.owner_signer_email && !a.entity.email) filled.missing.push("the signer's e-mail");
  const { data: requests } = await db
    .from("signature_request")
    .select("id, status, created_at, completed_at, signed_document_id, signature_signer(name, email, role, status, signed_at, sign_order)")
    .eq("management_agreement_id", a.id)
    .order("created_at", { ascending: false });
  return { agreement: a, terms, allProperties: all, properties: included, template: MANAGEMENT_AGREEMENT, ...filled, requests: requests ?? [] };
}
