// Security deposit deadlines after move-out (Fla. Stat. 83.49(3)). Dates are YYYY-MM-DD.
//  (a) No claim: return the deposit within 15 days after the tenancy ends.
//      Claim: written notice by certified mail (or e-mail under 83.505) within 30 days, in the statutory form;
//      miss it and the right to claim against the deposit is forfeited.
//  (b) The tenant has 15 days after receiving the notice to object; with no objection the landlord deducts
//      the claim and must remit the balance within 30 days after the date of the notice.

const add = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysUntil = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);

export function depositDeadlines(vacatedOn: string) {
  return { returnBy: add(vacatedOn, 15), claimNoticeBy: add(vacatedOn, 30) };
}

/**
 * After a claim notice: when the objection window has likely closed (15 days after receipt; certified mail
 * is assumed received 5 days after sending, e-mail the same day) and when the balance must be paid.
 */
export function claimDeadlines(noticeSentOn: string, method: "certified_mail" | "email_addendum") {
  return { objectionEnds: add(noticeSentOn, 15 + (method === "certified_mail" ? 5 : 0)), balanceDueBy: add(noticeSentOn, 30) };
}

/** How the deposit settles: applied to what's owed (only after a timely claim), the rest refunded. */
export function settlement(depositHeldCents: number, owedCents: number, claimed: boolean) {
  const apply = claimed ? Math.max(0, Math.min(depositHeldCents, owedCents)) : 0;
  return { applyCents: apply, refundCents: depositHeldCents - apply, stillOwedCents: Math.max(0, owedCents - apply) };
}

/** Deposit still held in trust: deposits received, less what was applied at move-out and refunded. */
export function depositHeldCents(payments: { purpose: string; status: string; amount_cents: number; reference: string | null }[], refundedCents: number | null | undefined): number {
  const received = payments.filter((p) => p.purpose === "deposit" && p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
  const applied = payments.filter((p) => p.reference === "Security deposit applied" && p.status === "succeeded").reduce((s, p) => s + p.amount_cents, 0);
  return Math.max(0, received - applied - (refundedCents ?? 0));
}
