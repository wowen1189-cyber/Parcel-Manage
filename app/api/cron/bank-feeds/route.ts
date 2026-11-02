import { NextResponse, type NextRequest } from "next/server";
import { countLinked, monthEndReconcile, syncFeed } from "@/lib/bank-feed-sync";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily job (vercel.json): brings in each linked bank account's new transactions from Stripe Financial
// Connections (Stripe refreshes them daily), matches them to the books, reconciles last month by itself when it
// ties (early each month), and counts linked accounts for billing.
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ skipped: "Stripe not set up" });

  const db = createAdminClient();
  const { data: accounts, error } = await db.from("bank_account").select("id, company_id, entity_id, gl_number, fc_account_id, fc_synced_at, fc_balance_cents, fc_balance_as_of, company(time_zone)").not("fc_account_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { accounts: 0, added: 0, matched: 0, failed: 0, reconciled: 0 };
  for (const a of accounts ?? []) {
    const r = await syncFeed(db, a, a.company.time_zone);
    result.accounts++;
    result.added += r.added;
    result.matched += r.matched;
    if (r.error) result.failed++;
    // Re-read the balance the sync may have just saved.
    const { data: fresh } = await db.from("bank_account").select("fc_balance_cents, fc_balance_as_of").eq("id", a.id).single();
    if ((await monthEndReconcile(db, { ...a, ...fresh }, a.company.time_zone)) === "done") result.reconciled++;
  }
  for (const companyId of new Set((accounts ?? []).map((a) => a.company_id))) await countLinked(db, companyId);
  return NextResponse.json(result);
}
