import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ROOT_DOMAIN } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl } from "@/lib/tenant";

export type Company = Database["public"]["Tables"]["company"]["Row"];
export type Membership = Database["public"]["Tables"]["membership"]["Row"];
export type PublicCompany = { id: string; name: string; office_phone: string | null };

// The company subdomain this request arrived on (set by proxy.ts), or null on the main site.
export const getRequestSubdomain = cache(async (): Promise<string | null> => {
  return (await headers()).get("x-company-subdomain");
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
  if (access.status === "no-access") redirect("/no-access");
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
