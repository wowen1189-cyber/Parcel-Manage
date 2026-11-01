import { NextResponse, type NextRequest } from "next/server";
import { runAutomations } from "@/lib/automations";
import { runAutopay } from "@/lib/autopay";
import { runBilling } from "@/lib/billing-run";
import { runRecurringBills } from "@/lib/bills";
import { todayIn } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily job (vercel.json): posts rent, recurring charges and late fees for every company that has turned
// automatic billing on, then creates recurring bills, drafts autopay (after rent posts, so the balance is current) and runs the
// automations (reminders and To do items). Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const db = createAdminClient();
  const { data: companies, error } = await db.from("company").select("id, name, office_email, settings, time_zone");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results: Record<string, unknown> = {};
  for (const c of companies ?? []) {
    const today = todayIn(c.time_zone);
    results[c.name] = { ...(await runBilling(db, c, today)), recurringBills: await runRecurringBills(db, c.id, today), autopay: await runAutopay(db, c.id, today), automations: await runAutomations(db, c, today) };
  }
  return NextResponse.json(results);
}
