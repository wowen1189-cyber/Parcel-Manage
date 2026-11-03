import type { NextRequest } from "next/server";
import { readTwilioWebhook, emptyTwiml } from "@/lib/integrations/twilio/webhook";
import { toE164 } from "@/lib/sms";
import { receiveText } from "@/lib/sms-send";
import { createAdminClient } from "@/lib/supabase/admin";

// Twilio "a message comes in" webhook for every company's number. The number texted (To) decides the company.

export async function POST(request: NextRequest) {
  const p = await readTwilioWebhook(request);
  if (!p) return new Response("Bad signature", { status: 403 });
  const to = toE164(p.To);
  if (!to || !p.From) return emptyTwiml();
  const db = createAdminClient();
  const { data: company } = await db.from("company").select("id, name, subdomain, office_email, sms_from_number, sms_alert_number, sms_live").eq("sms_from_number", to).maybeSingle();
  if (company) await receiveText(db, company, p.From, p.Body ?? "", p.MessageSid ?? null);
  return emptyTwiml();
}
