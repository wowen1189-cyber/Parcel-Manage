import { NextResponse, type NextRequest } from "next/server";
import { countLinked, syncFeed } from "@/lib/bank-feed-sync";
import { stripeConfigured } from "@/lib/integrations/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily job (vercel.json): brings in each linked bank account's new transactions from Stripe Financial
// Connections (Stripe refreshes them daily), matches them to the books, and counts linked accounts for billing.
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anyone else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ skipped: "Stripe not set up" });

  const db = createAdminClient();
  const { data: accounts, error } = await db.from("bank_account").select("id, company_id, fc_account_id, fc_synced_at, company(time_zone)").not("fc_account_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { accounts: 0, added: 0, matched: 0, failed: 0 };
  for (const a of accounts ?? []) {
    const r = await syncFeed(db, a, a.company.time_zone);
    result.accounts++;
    result.added += r.added;
    result.matched += r.matched;
    if (r.error) result.failed++;
  }
  for (const companyId of new Set((accounts ?? []).map((a) => a.company_id))) await countLinked(db, companyId);
  return NextResponse.json(result);
}
