import { NextResponse, type NextRequest } from "next/server";
import { runBilling } from "@/lib/billing-run";
import { runRecurringBills } from "@/lib/bills";
import { todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily job (vercel.json): posts rent, recurring charges and late fees for every company that has turned
// automatic billing on. Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const db = createAdminClient();
  const { data: companies, error } = await db.from("company").select("id, name, settings, time_zone");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results: Record<string, unknown> = {};
  for (const c of companies ?? []) {
    const today = todayIn(c.time_zone);
    results[c.name] = { ...(await runBilling(db, c, today)), recurringBills: await runRecurringBills(db, c.id, today) };
  }
  return NextResponse.json(results);
}
