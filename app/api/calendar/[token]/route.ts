import { NextResponse, type NextRequest } from "next/server";
import { companyEvents } from "@/lib/calendar";
import { ROOT_DOMAIN } from "@/lib/env";
import { buildCalendar } from "@/lib/ical";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyUrl } from "@/lib/tenant";
import { hashToken } from "@/lib/vendor-requests";

// A person's private calendar subscription (Google Calendar → Other calendars → From URL). The token is the
// only credential (its hash is stored); a new link from the Calendar page replaces the old one. Covers the last
// 30 days and the next 12 months; calendar apps re-read it every few hours.

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{20,}$/.test(clean)) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: feed } = await db.from("calendar_feed").select("id, company_id, company(name, subdomain)").eq("token_hash", hashToken(clean)).maybeSingle();
  if (!feed?.company?.subdomain) return new NextResponse("Not found", { status: 404 });
  const now = Date.now();
  const events = await companyEvents(db, feed.company_id, new Date(now - 30 * 86_400_000).toISOString(), new Date(now + 365 * 86_400_000).toISOString(), companyUrl(feed.company.subdomain, ROOT_DOMAIN, "").replace(/\/$/, ""));
  await db.from("calendar_feed").update({ last_read_at: new Date().toISOString() }).eq("id", feed.id);
  return new NextResponse(buildCalendar(`${feed.company.name} (Parcel Manage)`, events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="parcel-manage.ics"', "Cache-Control": "private, max-age=900" },
  });
}
