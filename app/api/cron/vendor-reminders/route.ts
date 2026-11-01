import { NextResponse, type NextRequest } from "next/server";
import { todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVendorRequest } from "@/lib/vendor-request-send";
import { itemsNeeded, reminderDue, requiredItems } from "@/lib/vendor-requests";

// Daily job (vercel.json): re-sends each open vendor paperwork request every few days until the vendor
// uploads everything, and closes requests whose paperwork the office entered by hand.
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });

  const db = createAdminClient();
  const { data: open, error } = await db
    .from("vendor_request")
    .select("id, company_id, vendor_id, send_count, last_sent_at, completed_at, cancelled_at, company(id, name, legal_name, subdomain, office_email, office_phone, time_zone), vendor(trade, is_1099, w9_on_file, coi_expires_on, workers_comp_expires_on, dispatch_override, is_active)")
    .is("completed_at", null)
    .is("cancelled_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const result = { reminded: 0, completed: 0, stopped: 0, failed: 0 };
  for (const r of open ?? []) {
    const today = todayIn(r.company.time_zone);
    if (!r.vendor.is_active) {
      await db.from("vendor_request").update({ cancelled_at: now.toISOString() }).eq("id", r.id);
      result.stopped++;
    } else if (!requiredItems(itemsNeeded(r.vendor, today)).length) {
      await db.from("vendor_request").update({ completed_at: now.toISOString() }).eq("id", r.id);
      result.completed++;
    } else if (reminderDue(r, now)) {
      const sent = await sendVendorRequest(db, r.company, r.vendor_id, { reminder: true });
      if (sent.ok) result.reminded++;
      else result.failed++;
    }
  }
  return NextResponse.json(result);
}
