"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROOT_DOMAIN } from "@/lib/env";
import { getOrigin, safeNext } from "@/lib/request";
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
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  // Same answer whether or not the account exists, so the form can't be used to check who has one.
  if (error && error.status !== 400 && error.status !== 422) return { error: "We couldn't send the link just now. Try again in a minute." };
  return { message: `If ${parsed.data} has an account, a sign-in link is on its way. It works for one hour.` };
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
        .refine(isValidSubdomain, "Use lowercase letters, numbers and hyphens (no spaces), for example simreipm."),
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
