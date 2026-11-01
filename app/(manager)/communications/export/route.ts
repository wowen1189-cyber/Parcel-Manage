import type { NextRequest } from "next/server";
import { csvResponse } from "@/lib/csv";
import { csvDate } from "@/lib/format";
import { requireCompany } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { supabase, company } = await requireCompany();
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  let query = supabase.from("message").select("subject, body, channel, delivery, legal, sender_name, sender_title, created_at, contact(first_name, last_name, business_name)").eq("company_id", company.id).eq("direction", "outbound").order("created_at", { ascending: false }).limit(5000);
  if (kind === "legal") query = query.eq("legal", true);
  if (kind === "letters") query = query.not("template_id", "is", null);
  const { data } = await query;
  return csvResponse(
    "sent-messages.csv",
    ["Sent", "To", "Subject", "Delivery", "Legal notice", "From", "Title", "Text"],
    (data ?? []).map((m) => [csvDate(m.created_at.slice(0, 10)), m.contact ? [m.contact.first_name, m.contact.last_name].filter(Boolean).join(" ") || m.contact.business_name : "", m.subject, m.delivery ?? m.channel, m.legal ? "Yes" : "No", m.sender_name, m.sender_title, m.body]),
  );
}
