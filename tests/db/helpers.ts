import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Database tests run against the real Supabase project with throwaway users and companies
// (subdomains start with "zz-test-"), which they delete afterwards.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

export type TestUser = { id: string; email: string; client: SupabaseClient<Database> };

const createdUsers: string[] = [];
const createdCompanies: string[] = [];

export const rand = () => randomBytes(4).toString("hex");

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `zz-test-${label}-${rand()}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${label}` } });
  if (error) throw error;
  createdUsers.push(data.user.id);
  const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

// Creates a company the way the app does (create_company), so the user becomes its admin.
export async function createTestCompany(owner: TestUser, label: string) {
  const subdomain = `zz-test-${label}-${rand()}`;
  const { data, error } = await owner.client.rpc("create_company", { p_name: `Test ${label}`, p_subdomain: subdomain });
  if (error) throw error;
  createdCompanies.push(data);
  return { id: data, subdomain };
}

export function trackCompany(id: string) {
  createdCompanies.push(id);
}

// Deleting the test companies also proves a whole company can be deleted (migration 0004).
export async function cleanup() {
  const failures: string[] = [];
  for (const id of createdCompanies.splice(0)) {
    const { error } = await admin.from("company").delete().eq("id", id);
    if (error) failures.push(`company ${id}: ${error.message}`);
  }
  for (const id of createdUsers.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
  if (failures.length) throw new Error(`Test cleanup failed:\n${failures.join("\n")}`);
}
