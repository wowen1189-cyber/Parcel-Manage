import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { contactName } from "@/lib/format";

// Work order list, shared by the Maintenance screen, its CSV export and the dashboard tile.

type Db = SupabaseClient<Database>;
export type WorkOrderFilters = { q: string; view: string; priority: string; property: string };

const PRIORITY_ORDER: Record<string, number> = { emergency: 0, urgent: 1, routine: 2 };

export async function listWorkOrders(supabase: Db, companyId: string, f: WorkOrderFilters) {
  let query = supabase
    .from("work_order")
    .select("id, number, title, priority, status, created_at, scheduled_start, scheduled_end, completed_at, cost_cents, property!inner(id, name), unit(label), vendor(id, contact(first_name, last_name, business_name))")
    .eq("company_id", companyId);
  if (f.view === "completed") query = query.in("status", ["completed", "canceled"]);
  else if (f.view !== "all") query = query.in("status", ["new", "assigned", "scheduled"]);
  if (f.priority) query = query.eq("priority", f.priority);
  if (f.property) query = query.eq("property_id", f.property);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
  if (error) throw error;

  const q = f.q.toLowerCase();
  return (data ?? [])
    .map((w) => ({ ...w, vendorName: w.vendor ? contactName(w.vendor.contact) : null, where: [w.property.name, w.unit?.label && w.unit.label !== "Home" ? w.unit.label : null].filter(Boolean).join(" · ") }))
    .filter((w) => !q || `#${w.number} ${w.title} ${w.where} ${w.vendorName ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) =>
      f.view === "completed" ? 0 : (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) || b.created_at.localeCompare(a.created_at),
    );
}
