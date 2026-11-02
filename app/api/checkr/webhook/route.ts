import { NextResponse, type NextRequest } from "next/server";
import { syncCheckrOrder } from "@/lib/checkr-screening";
import { verifyTenantSignature } from "@/lib/integrations/checkr/rules";
import { createAdminClient } from "@/lib/supabase/admin";

// Checkr Tenant webhooks: report and order events. The raw body is checked against Tenant-Signature with
// CHECKR_WEBHOOK_SECRET before anything else; Checkr's "Test" button sends an empty, unsigned probe, which is
// acknowledged and ignored. Each event is handled once; unknown types are acknowledged and ignored.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!raw.trim()) return NextResponse.json({ received: true });
  if (!verifyTenantSignature(raw, request.headers.get("tenant-signature"), process.env.CHECKR_WEBHOOK_SECRET)) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { id?: string; type?: string; data?: { id?: string; order_id?: string } };
  if (!event.id || !event.type) return NextResponse.json({ received: true });
  const db = createAdminClient();
  const { error: dup } = await db.from("checkr_event").insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ received: true, duplicate: true });
  const orderId = event.data?.order_id ?? (event.data?.id?.startsWith("ord_") ? event.data.id : undefined);
  if (!orderId || !["report.completed", "report.product.completed", "order.applicant.completed", "order.applicant.started"].includes(event.type)) return NextResponse.json({ received: true });
  const { data: row } = await db.from("screening_order").select("id").eq("order_id", orderId).maybeSingle();
  if (!row) return NextResponse.json({ received: true });
  try {
    await syncCheckrOrder(db, row.id);
  } catch {
    // Let Checkr retry later: forget the event so the retry is handled.
    await db.from("checkr_event").delete().eq("id", event.id);
    return NextResponse.json({ error: "Couldn't reach Checkr" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
