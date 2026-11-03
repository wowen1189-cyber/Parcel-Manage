import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Parcel Manage's one Twilio account (platform level, docs/05). Keys come from the environment only.

export function twilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/** Sends one text. Never throws: returns Twilio's message id, or the reason it failed. */
export async function sendTwilioSms(input: { from: string; to: string; body: string; statusCallback?: string }): Promise<{ sid: string } | { error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { error: "Twilio isn't connected." };
  const form = new URLSearchParams({ From: input.from, To: input.to, Body: input.body });
  if (input.statusCallback) form.set("StatusCallback", input.statusCallback);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    return res.ok && data.sid ? { sid: data.sid } : { error: data.message ?? `Twilio said ${res.status}.` };
  } catch {
    return { error: "Couldn't reach Twilio." };
  }
}

/** Twilio's signature: HMAC-SHA1 of the full URL plus each POST field (sorted by name) as name+value, base64. */
export function twilioSignature(token: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", token).update(data, "utf8").digest("base64");
}

export function validTwilioRequest(url: string, params: Record<string, string>, signature: string | null, token = process.env.TWILIO_AUTH_TOKEN): boolean {
  if (!token || !signature) return false;
  const want = Buffer.from(twilioSignature(token, url, params));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}
