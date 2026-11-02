import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { nextMaintenanceDate } from "./recurring-maintenance-rules";

// Daily: each active schedule whose date has come creates one work order (routine, source "recurring",
// status "new") and moves to its next date. A missed run catches up with one work order, not several.
export async function runRecurringMaintenance(db: SupabaseClient<Database>, companyId: string, today: string): Promise<number> {
  const { data: due } = await db.from("recurring_work_order").select("id, property_id, unit_id, title, details, vendor_id, frequency, next_on").eq("company_id", companyId).eq("active", true).lte("next_on", today);
  let created = 0;
  for (const r of due ?? []) {
    const { data: wo } = await db
      .from("work_order")
      .insert({
        company_id: companyId,
        property_id: r.property_id,
        unit_id: r.unit_id,
        source: "recurring",
        title: r.title,
        priority: "routine",
        tenant_note: [r.details, r.vendor_id ? "Usual vendor is set on the schedule; assign them to send the job." : null].filter(Boolean).join("\n\n") || null,
        status: "new",
      })
      .select("id")
      .single();
    if (!wo) continue;
    await db.from("work_order_event").insert({ company_id: companyId, work_order_id: wo.id, kind: "created", detail: { by: "recurring schedule", schedule_id: r.id } });
    let next = r.next_on;
    while (next <= today) next = nextMaintenanceDate(next, r.frequency);
    await db.from("recurring_work_order").update({ next_on: next, last_work_order_id: wo.id }).eq("id", r.id);
    created++;
  }
  return created;
}
