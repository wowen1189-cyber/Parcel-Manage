import "server-only";
import { readBusinessRules } from "@/lib/business-rules";
import { money } from "@/lib/format";
import { getPublicCompany } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads for the public rentals and application pages: only published listings of the subdomain's company.

export async function publicCompany() {
  const pub = await getPublicCompany();
  if (!pub) return null;
  const { data } = await createAdminClient().from("company").select("id, name, office_phone, office_email, settings, stripe_charges_enabled").eq("id", pub.id).single();
  return data;
}

export async function publishedListings(companyId: string) {
  const { data } = await createAdminClient()
    .from("listing")
    .select("id, headline, description, rent_cents, deposit_cents, available_on, pets_allowed, amenities, photos, unit(id, label, kind, beds, baths, sqft, property(name, address_line1, city, state, postal_code))")
    .eq("company_id", companyId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return data ?? [];
}

export function feeText(settings: unknown, role: string, online: boolean) {
  const f = readBusinessRules(settings).fees;
  const total = f.applicationFeePerAdultCents + (role === "applicant" ? f.adminFeeCents : 0);
  if (!total) return "There's no application fee.";
  const parts = [`${money(f.applicationFeePerAdultCents)} application fee for each adult`];
  if (role === "applicant" && f.adminFeeCents) parts.push(`plus an admin fee of ${money(f.adminFeeCents)}${f.refundAdminFeeIfDenied ? " (refunded if your application is denied)" : ""}`);
  return `Fees: ${parts.join(", ")}. ${online ? `You'll pay ${money(total)} by card on the next screen.` : "The office will contact you to collect the fee."} The application fee isn't refundable.`;
}
