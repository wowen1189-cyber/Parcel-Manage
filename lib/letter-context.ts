import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLedger } from "@/lib/ledger";
import { contactName, oneLineAddress, todayIn } from "@/lib/format";
import type { LetterContext } from "@/lib/letters";
import type { Database } from "@/lib/supabase/database.types";

// Everything a letter needs about one lease, read with the staff member's own session.
type Db = SupabaseClient<Database>;
type CompanyLike = { id: string; name: string; legal_name: string | null; address: string | null; office_phone: string | null; time_zone: string };

export async function letterContext(supabase: Db, company: CompanyLike, leaseId: string, sender: { name: string; title: string }) {
  const { data: l } = await supabase
    .from("lease")
    .select(
      "id, rent_cents, end_date, email_notices_agreed, opening_balance_cents, opening_balance_as_of, unit(label, property(name, county, address_line1, address_line2, city, state, postal_code, entity(name))), lease_tenant(role, is_primary, contact(id, kind, first_name, last_name, business_name, email)), charge(id, charge_type, description, amount_cents, due_date, created_at), payment(id, method, amount_cents, received_on, status, purpose, reference, returned_on, created_at)",
    )
    .eq("id", leaseId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!l) return null;
  const tenants = l.lease_tenant.filter((t) => t.role === "tenant").sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const p = l.unit.property;
  const premises = oneLineAddress({ ...p, address_line2: [p.address_line2, l.unit.label !== "Home" ? `Unit ${l.unit.label}` : null].filter(Boolean).join(", ") });
  const ledger = buildLedger(l.charge, l.payment, { cents: l.opening_balance_cents, asOf: l.opening_balance_as_of });
  // Rent owed: the balance, but no more than the unpaid rent charges (a 3-day notice is for rent only, 83.56(3)).
  const rentCharged = l.charge.filter((c) => c.charge_type === "rent").reduce((s, c) => s + c.amount_cents, 0);
  const ctx: LetterContext = {
    companyName: company.legal_name ?? company.name,
    companyAddress: company.address ?? "",
    companyPhone: company.office_phone ?? "",
    landlordName: p.entity?.name ?? company.name,
    tenantNames: tenants.map((t) => contactName(t.contact)).join(", "),
    premises,
    county: p.county ?? "",
    rentCents: l.rent_cents,
    balanceCents: Math.max(0, ledger.balanceCents),
    rentOwedCents: Math.max(0, Math.min(ledger.balanceCents, rentCharged || l.rent_cents)),
    leaseEnd: l.end_date,
    today: todayIn(company.time_zone),
    senderName: sender.name,
    senderTitle: sender.title,
  };
  return { ctx, tenants: tenants.map((t) => t.contact), emailNotices: l.email_notices_agreed, propertyName: p.name, unitLabel: l.unit.label };
}
