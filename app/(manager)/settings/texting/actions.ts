"use server";

import { revalidatePath } from "next/cache";
import { twilioConfigured } from "@/lib/integrations/twilio/client";
import { isAdmin, requireCompany } from "@/lib/session";
import { toE164 } from "@/lib/sms";

export type TextingState = { error?: string; message?: string; values?: Record<string, string> };

/** The company's texting number, who gets emergency texts, and whether texts really go out. */
export async function saveTexting(_: TextingState, form: FormData): Promise<TextingState> {
  const { supabase, company, membership } = await requireCompany();
  if (!isAdmin(membership)) return { error: "Only an admin can change this." };
  const rawFrom = String(form.get("sms_from_number") ?? "").trim();
  const rawAlert = String(form.get("sms_alert_number") ?? "").trim();
  const values = { sms_from_number: rawFrom, sms_alert_number: rawAlert, sms_live: form.get("sms_live") === "on" ? "on" : "" };
  const from = rawFrom ? toE164(rawFrom) : null;
  const alert = rawAlert ? toE164(rawAlert) : null;
  if (rawFrom && !from) return { error: "Enter the texting number as a 10-digit US number.", values };
  if (rawAlert && !alert) return { error: "Enter the emergency alert number as a 10-digit US mobile number.", values };
  const live = form.get("sms_live") === "on";
  if (live && (!twilioConfigured() || !from)) return { error: "Real texts need Parcel Manage's Twilio account and your texting number first.", values };
  const { error } = await supabase.from("company").update({ sms_from_number: from, sms_alert_number: alert, sms_live: live }).eq("id", company.id);
  if (error) return { error: error.code === "23505" ? "Another company already uses that texting number." : error.message, values };
  revalidatePath("/", "layout");
  return { message: live ? "Saved. Real texts are on." : "Saved. Texts stay in practice mode." };
}
