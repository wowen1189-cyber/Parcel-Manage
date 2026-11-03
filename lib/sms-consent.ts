// Text message consent (TCPA, 47 U.S.C. 227, and carrier rules): only the person themselves can opt in, in
// writing, after seeing this; STOP always opts out. Staff can record an opt-out but never an opt-in.
export function smsConsentText(companyName: string): string {
  return `I agree to receive text messages from ${companyName} about my account, rent, repairs and building notices at the mobile number above. Message frequency varies. Message and data rates may apply. Reply STOP to stop or HELP for help. Agreeing isn't a condition of renting.`;
}

/** The same consent for vendors, about their jobs. */
export function vendorSmsConsentText(companyName: string): string {
  return `I agree to receive text messages from ${companyName} about jobs and work orders at the mobile number above. Message frequency varies. Message and data rates may apply. Reply STOP to stop or HELP for help. Agreeing isn't a condition of getting work.`;
}

export type SmsStatus = "opted_in" | "opted_out" | "not_asked";
export function smsStatus(c: { sms_opt_in: boolean; sms_opt_out_at: string | null }): SmsStatus {
  return c.sms_opt_in ? "opted_in" : c.sms_opt_out_at ? "opted_out" : "not_asked";
}
