import type { NextRequest } from "next/server";
import { readTwilioWebhook, emptyTwiml } from "@/lib/integrations/twilio/webhook";
import { createAdminClient } from "@/lib/supabase/admin";

// Twilio delivery updates for texts we sent: sent, delivered, undelivered or failed.
const STATUS: Record<string, string> = { sent: "sent", delivered: "delivered", undelivered: "failed", failed: "failed" };

export async function POST(request: NextRequest) {
  const p = await readTwilioWebhook(request);
  if (!p) return new Response("Bad signature", { status: 403 });
  const status = STATUS[p.MessageStatus ?? ""];
  // Updates can arrive out of order: a late "sent" never replaces "delivered".
  if (status && p.MessageSid) await createAdminClient().from("message").update({ status }).eq("provider_ref", p.MessageSid).eq("channel", "sms").neq("status", status === "sent" ? "delivered" : "");
  return emptyTwiml();
}
