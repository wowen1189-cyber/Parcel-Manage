import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ROOT_DOMAIN } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl, subdomainFromHost } from "@/lib/tenant";

export type Company = Database["public"]["Tables"]["company"]["Row"];
export type Membership = Database["public"]["Tables"]["membership"]["Row"];
export type PublicCompany = { id: string; name: string; office_phone: string | null };

// The company subdomain this request arrived on (set by proxy.ts), or null on the main site.
// Falls back to reading the host: the page rendered right after a server action's redirect
// doesn't always carry the header proxy.ts added.
export const getRequestSubdomain = cache(async (): Promise<string | null> => {
  const h = await headers();
  return h.get("x-company-subdomain") ?? subdomainFromHost(h.get("x-forwarded-host") ?? h.get("host"), ROOT_DOMAIN);
});

// Company shown on this subdomain before sign-in (only its id, name and office phone).
export const getPublicCompany = cache(async (): Promise<PublicCompany | null> => {
  const subdomain = await getRequestSubdomain();
  if (!subdomain) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("company_by_subdomain", { p_subdomain: subdomain });
  return data?.[0] ?? null;
});

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export type CompanyAccess =
  | { status: "ok"; company: Company; membership: Membership }
  | { status: "no-company" } // signed in, belongs to no company yet
  | { status: "no-access" } // signed in on a company subdomain the user doesn't belong to
  | { status: "unknown-subdomain" };

// Which company may this user work in on this request?
// On a company subdomain: only that company, and only if the user is an active member.
// Anywhere else (main site, Vercel preview address): the user's own company.
export async function resolveCompanyAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  subdomain: string | null,
): Promise<CompanyAccess> {
  let companyId: string | null = null;
  if (subdomain) {
    const { data } = await supabase.rpc("company_by_subdomain", { p_subdomain: subdomain });
    if (!data?.[0]) return { status: "unknown-subdomain" };
    companyId = data[0].id;
  }

  let query = supabase
    .from("membership")
    .select("*")
    .eq("profile_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (companyId) query = query.eq("company_id", companyId);
  const { data: memberships } = await query;
  const membership = memberships?.[0];
  if (!membership) return { status: companyId ? "no-access" : "no-company" };

  const { data: company } = await supabase.from("company").select("*").eq("id", membership.company_id).single();
  if (!company) return { status: "no-access" };
  return { status: "ok", company, membership };
}

// For pages inside the manager app: the signed-in user and their company, or a redirect.
export const requireCompany = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const subdomain = await getRequestSubdomain();
  const supabase = await createClient();
  const access = await resolveCompanyAccess(supabase, user.id, subdomain);

  if (access.status === "unknown-subdomain") redirect("/no-company");
  if (access.status === "no-access") {
    // Not staff here: a tenant goes to their portal instead (linked by verified e-mail, migration 0017).
    const { data: c } = await supabase.rpc("company_by_subdomain", { p_subdomain: subdomain ?? "" });
    const { data: leases } = c?.[0] ? await supabase.rpc("claim_portal", { p_company: c[0].id }) : { data: 0 };
    if (leases) redirect("/portal");
    // An owner or partner goes to the owner portal (migration 0027).
    const { data: owned } = c?.[0] ? await supabase.from("entity").select("id").eq("company_id", c[0].id).limit(1) : { data: [] };
    redirect(owned?.length ? "/owner" : "/no-access");
  }
  if (access.status === "no-company") redirect("/welcome");

  // On the main site itself (not a preview address), send people to their company's own address.
  const host = (await headers()).get("host");
  if (!subdomain && host === ROOT_DOMAIN && access.company.subdomain) {
    redirect(companyUrl(access.company.subdomain, ROOT_DOMAIN, "/dashboard"));
  }

  return { user, supabase, ...access };
});

export function isAdmin(membership: Membership) {
  return membership.role === "admin";
}
