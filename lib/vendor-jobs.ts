import "server-only";
import { getRequestSubdomain } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/vendor-requests";

// A vendor's job, found by the private link token (its hash is stored on the work order). Null when the link
// was replaced, the job was declined or canceled, or it's opened on another company's site.
export async function loadJob(token: string) {
  const db = createAdminClient();
  const subdomain = await getRequestSubdomain();
  const { data: wo } = await db
    .from("work_order")
    .select(
      "id, company_id, number, title, priority, status, ai_summary, room, entry_ok, pets_in_home, tenant_note, scheduled_start, scheduled_end, vendor_accepted_at, vendor_declined_at, vendor_completed_at, completed_at, resolution, vendor_id, property_id, unit_id, company(id, name, legal_name, subdomain, office_phone, office_email, time_zone, settings), property(id, name, entity_id, address_line1, address_line2, city, state, postal_code), unit(id, label, status, lease(id, status, email_notices_agreed, lease_tenant(role, contact(first_name, last_name, business_name, kind, email, mobile, phone)))), vendor(id, contact(first_name, last_name, business_name, kind))",
    )
    .eq("vendor_token_hash", hashToken(token))
    .maybeSingle();
  if (!wo || wo.company.subdomain !== subdomain || wo.status === "canceled" || wo.vendor_declined_at) return null;
  return { db, wo };
}

