import "server-only";
import type { NextRequest } from "next/server";
import { validTwilioRequest } from "./client";

// Reads a Twilio webhook (form fields) and checks its signature against the exact address Twilio called.
export async function readTwilioWebhook(request: NextRequest): Promise<Record<string, string> | null> {
  const params = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return validTwilioRequest(url, params, request.headers.get("x-twilio-signature")) ? params : null;
}

// An empty reply: Parcel Manage never answers automatically. STOP, START and HELP replies come from the
// opt-out settings on Twilio's side.
export const emptyTwiml = () => new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", { headers: { "Content-Type": "text/xml" } });
