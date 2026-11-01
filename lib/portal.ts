import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestSubdomain, getUser } from "@/lib/session";

// Tenant portal: the signed-in person on a company's site, linked to their tenant records by verified e-mail
// (claim_portal), and the leases they can see. Row Level Security limits every query to their own records
// (migration 0017), so portal pages use the person's own session, never the service role.

export type PortalCompany = { id: string; name: string; office_phone: string | null; time_zone: string; office_email: string | null };

export const requireTenant = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/portal");
  const subdomain = await getRequestSubdomain();
  if (!subdomain) redirect("/no-company");
  const supabase = await createClient();
  const { data: companies } = await supabase.rpc("company_by_subdomain", { p_subdomain: subdomain });
  const found = companies?.[0];
  if (!found) redirect("/no-company");
  // Public company details tenants may see (the company table itself is staff-only).
  const { data: extra } = await createAdminClient().from("company").select("time_zone, office_email").eq("id", found.id).single();
  const company: PortalCompany = { ...found, time_zone: extra?.time_zone ?? "America/New_York", office_email: extra?.office_email ?? null };
  const { data: count } = await supabase.rpc("claim_portal", { p_company: company.id });
  if (!count) redirect("/no-access");
  const { data: leases } = await supabase
    .from("lease")
    .select("id, status, start_date, end_date, move_out_on, rent_cents, deposit_cents, unit(id, label, kind, property(id, name, address_line1, address_line2, city, state, postal_code)), lease_tenant(is_primary, role, contact(id, first_name, last_name, business_name, kind, email, mobile, portal_profile_id))")
    .eq("company_id", company.id)
    .order("start_date", { ascending: false });
  const current = (leases ?? []).find((l) => l.status === "active" || l.status === "notice") ?? leases?.[0];
  if (!current) redirect("/no-access");
  const me = current.lease_tenant.find((t) => t.contact.portal_profile_id === user.id)?.contact ?? current.lease_tenant[0].contact;
  return { user, supabase, company, leases: leases ?? [], lease: current, me };
});

/** Owner portal: the owners (LLCs) whose records list the signed-in person's verified e-mail, here. */
export const requireOwner = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/owner");
  const subdomain = await getRequestSubdomain();
  if (!subdomain) redirect("/no-company");
  const supabase = await createClient();
  const { data: companies } = await supabase.rpc("company_by_subdomain", { p_subdomain: subdomain });
  const company = companies?.[0];
  if (!company) redirect("/no-company");
  const { data: owners } = await supabase.from("entity").select("id, name, property(id, name, unit(status))").eq("company_id", company.id).order("name");
  if (!owners?.length) redirect("/no-access");
  return { user, supabase, company, owners };
});
