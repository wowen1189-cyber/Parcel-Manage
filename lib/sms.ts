// Texting rules that don't need the database (CLAUDE.md rule 6; TCPA, 47 U.S.C. 227, and carrier rules).
// Sending and receiving live in lib/sms-send.ts.

/** A US mobile number as Twilio wants it (+1 and 10 digits), or null if it isn't one. */
export function toE164(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

/** (352) 555-0100 for showing a number. */
export function prettyPhone(e164: string | null | undefined): string {
  const d = (e164 ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : (e164 ?? "");
}

// Carrier opt-out and opt-in words (CTIA). Any of these as the whole message counts.
const STOP = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT", "OPT OUT", "STOP ALL"];
const START = ["START", "UNSTOP", "YES"];
const HELP = ["HELP", "INFO"];
const word = (body: string) => body.trim().replace(/[.!\s]+$/, "").toUpperCase();

export type Keyword = "stop" | "start" | "help" | null;
export function keyword(body: string): Keyword {
  const w = word(body);
  return STOP.includes(w) ? "stop" : START.includes(w) ? "start" : HELP.includes(w) ? "help" : null;
}

export const MAX_TEXT = 480;

/** What the person receives: the company's name first, and how to stop on the first text they get. */
export function outboundText(companyName: string, body: string, first: boolean): string {
  const text = body.trim();
  const named = text.toLowerCase().startsWith(companyName.toLowerCase()) ? text : `${companyName}: ${text}`;
  return first ? `${named}\nReply STOP to opt out.` : named;
}

export type TextMode = { live: boolean; reason: string };
/** Real texts need Parcel Manage's Twilio account, the company's number, and an admin's switch. Otherwise practice. */
export function textMode(company: { sms_from_number: string | null; sms_live: boolean }, twilioReady: boolean): TextMode {
  if (!twilioReady) return { live: false, reason: "Parcel Manage's Twilio account isn't connected yet." };
  if (!company.sms_from_number) return { live: false, reason: "The company has no texting number yet." };
  if (!company.sms_live) return { live: false, reason: "Real texts are switched off in Settings › Texting." };
  return { live: true, reason: "" };
}
