import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

// Document lists for the office, the resident portal and the owner portal. The query runs with the viewer's own
// session, so Row Level Security decides what they may see (migration 0059: the office shares each file with
// the tenant and/or the owner; leases and renewals are shared with both by default). Only the links to open the
// files are made with the service role, for rows the viewer could already read.

type Db = SupabaseClient<Database>;
export type DocRow = { id: string; file_name: string; category: string; created_at: string; storage_path: string; office_only: boolean; shared_with_owner: boolean; lease_id: string | null; property_id: string | null; entity_id: string | null };

const COLUMNS = "id, file_name, category, created_at, storage_path, office_only, shared_with_owner, lease_id, property_id, entity_id";

export async function listDocuments(db: Db, companyId: string, where: { leaseIds?: string[]; propertyIds?: string[]; propertyOnly?: boolean; entityId?: string; sharedWithOwner?: boolean; sharedWithTenant?: boolean }, limit = 300): Promise<DocRow[]> {
  let q = db.from("document").select(COLUMNS).eq("company_id", companyId);
  if (where.leaseIds) q = q.in("lease_id", where.leaseIds.length ? where.leaseIds : ["00000000-0000-0000-0000-000000000000"]);
  if (where.propertyIds) q = q.in("property_id", where.propertyIds.length ? where.propertyIds : ["00000000-0000-0000-0000-000000000000"]);
  if (where.propertyOnly) q = q.is("lease_id", null).is("work_order_id", null).is("bill_id", null);
  if (where.entityId) q = q.eq("entity_id", where.entityId);
  if (where.sharedWithOwner) q = q.eq("shared_with_owner", true);
  if (where.sharedWithTenant) q = q.eq("office_only", false);
  const { data } = await q.order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as DocRow[];
}

/** Ten-minute links to open each file. */
export async function documentLinks(docs: { storage_path: string }[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (!docs.length) return links;
  const { data } = await createAdminClient().storage.from("documents").createSignedUrls(docs.map((d) => d.storage_path), 600);
  for (const x of data ?? []) if (x.path && x.signedUrl) links.set(x.path, x.signedUrl);
  return links;
}

export const DOCUMENT_TYPE_LABEL: Record<string, string> = { lease: "Lease", notice: "Notice", statement: "Statement", insurance: "Insurance", inspection: "Inspection", photo: "Photo", application: "Application", invoice: "Invoice", other: "Other" };
