"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROOT_DOMAIN } from "@/lib/env";
import { getOrigin, safeNext } from "@/lib/request";
import { getRequestSubdomain } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { companyUrl, isValidSubdomain } from "@/lib/tenant";

export type FormState = { error?: string; message?: string; fields?: Record<string, string> };

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");

export async function signInWithPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password.") })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email: String(form.get("email") ?? "") } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "That email and password don't match. Try again or email yourself a sign-in link.", fields: { email: parsed.data.email } };
  redirect(safeNext(form.get("next")));
}

export async function sendSignInLink(_: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const next = safeNext(form.get("next"));
  // A tenant on file at this company may sign in for the first time: their account is created on first use.
  // Anyone else needs an account (or invite) already. The answer below is the same either way.
  const firstTime = await isTenantOnFile(parsed.data);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: firstTime, emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(firstTime && next === "/dashboard" ? "/portal" : next)}` },
  });
  // Same answer whether or not the account exists, so the form can't be used to check who has one.
  // 429: a link went to this address less than a minute ago.
  if (error?.status === 429) return { error: "A link was just sent to that address. Use the newest email, or wait a minute and ask again." };
  if (error && error.status !== 400 && error.status !== 422) return { error: "We couldn't send the link just now. Try again in a minute." };
  return { message: `If ${parsed.data} has an account, a sign-in link is on its way. It works for one hour.` };
}

/** Is this e-mail on a tenant record (current or upcoming lease) at the company whose site this is? Server-only check. */
async function isTenantOnFile(address: string): Promise<boolean> {
  const subdomain = await getRequestSubdomain();
  if (!subdomain) return false;
  const db = createAdminClient();
  const { data: company } = await db.from("company").select("id").eq("subdomain", subdomain).maybeSingle();
  if (!company) return false;
  const { data } = await db
    .from("lease_tenant")
    .select("contact!inner(email), lease!inner(status)")
    .eq("company_id", company.id)
    .eq("role", "tenant")
    .in("lease.status", ["active", "notice", "draft", "pending_signature"])
    .ilike("contact.email", `%${address.replace(/[%_]/g, "")}%`)
    .limit(5);
  if ((data ?? []).some((r) => (r.contact.email ?? "").toLowerCase().split(/\s*[,;]\s*/).includes(address))) return true;
  // Owners and partners may sign in to the owner portal too.
  const { data: owners } = await db.from("entity").select("email, property(property_owner(contact(email)))").eq("company_id", company.id);
  const emails = (owners ?? []).flatMap((o) => [o.email, ...o.property.flatMap((p) => p.property_owner.map((x) => x.contact?.email))]);
  return emails.some((e) => (e ?? "").toLowerCase().split(/\s*[,;]\s*/).includes(address));
}

const EMAIL_LINK_TYPES = ["email", "magiclink", "signup", "recovery", "email_change", "invite"] as const;

// The "One more tap" button on /continue: trades the emailed token for a signed-in session.
export async function confirmEmailLink(form: FormData): Promise<void> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = z.enum(EMAIL_LINK_TYPES).safeParse(form.get("type"));
  const next = safeNext(form.get("next"));
  if (!tokenHash || !type.success) redirect("/sign-in?link=expired");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data });
  redirect(error ? "/sign-in?link=expired" : next);
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const fields = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Enter your full name.").max(80),
      email,
      password: z.string().min(10, "Use at least 10 characters for your password."),
    })
    .safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const next = safeNext(form.get("next"), "/welcome");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message, fields };
  if (data.session) redirect(next);
  return { message: `Check ${parsed.data.email} for a link to confirm your email. Then you'll set up your company.` };
}

export async function createCompany(_: FormState, form: FormData): Promise<FormState> {
  const fields = { name: String(form.get("name") ?? ""), subdomain: String(form.get("subdomain") ?? "").toLowerCase() };
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your company's name.").max(100),
      subdomain: z
        .string()
        .trim()
        .toLowerCase()
        .refine(isValidSubdomain, "Use lowercase letters, numbers and hyphens (no spaces), for example sunrisepm."),
      timeZone: z.string().min(1),
    })
    .safeParse({ name: form.get("name"), subdomain: form.get("subdomain"), timeZone: form.get("timeZone") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { data: free } = await supabase.rpc("subdomain_available", { p_subdomain: parsed.data.subdomain });
  if (!free) return { error: `${parsed.data.subdomain}.${ROOT_DOMAIN} is taken. Pick another web address.`, fields };

  const { error } = await supabase.rpc("create_company", {
    p_name: parsed.data.name,
    p_subdomain: parsed.data.subdomain,
    p_time_zone: parsed.data.timeZone,
  });
  if (error) return { error: error.message, fields };

  // Locally the sign-in cookie doesn't follow you to the subdomain, so you sign in once more there.
  const path = ROOT_DOMAIN.startsWith("localhost") ? "/sign-in?created=1" : "/dashboard";
  redirect(companyUrl(parsed.data.subdomain, ROOT_DOMAIN, path));
}

export async function acceptInvitation(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
