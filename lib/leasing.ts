import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHtml, emailText } from "@/lib/email/layout";
import { ROOT_DOMAIN } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/integrations/resend/send";
import { newToken } from "@/lib/vendor-requests";
import type { Database } from "@/lib/supabase/database.types";
import { companyUrl } from "@/lib/tenant";

// Leasing: listings, guest cards, application links and the adverse action notice. Screening rules are in
// lib/screening.ts (pure, tested).

type Db = SupabaseClient<Database>;

export const APPLICATION_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "warn" | "success" | "danger" }> = {
  invited: { label: "Invited", tone: "neutral" },
  new: { label: "New", tone: "info" },
  screening: { label: "Screening", tone: "warn" },
  approved: { label: "Approved", tone: "success" },
  lease_sent: { label: "Lease sent", tone: "success" },
  signed: { label: "Signed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};
export const PIPELINE = ["invited", "new", "screening", "approved", "lease_sent", "signed", "declined"] as const;

export const GUEST_STATUS: Record<string, string> = { new: "New", contacted: "Contacted", showing: "Showing booked", applied: "Applied", lost: "Not moving forward" };
export const GUEST_SOURCES: Record<string, string> = {
  website: "Company website",
  zillow: "Zillow",
  apartments: "Apartments.com",
  facebook: "Facebook",
  sign: "Yard sign",
  referral: "Referral",
  phone: "Phone call",
  walk_in: "Walk-in",
  other: "Other",
};

export const unitName = (u: { label: string; property: { name: string } }) => (u.label === "Home" || u.label === "House" ? u.property.name : `${u.property.name} ${u.label}`);

/** Signed links (one hour) for listing photos kept in the private documents bucket. */
export async function photoUrls(db: Db, paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await db.storage.from("documents").createSignedUrls(paths, 3600);
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

/** A personal application link for one adult. Returns the link; e-mails it when there's an address. */
export async function inviteMember(
  db: Db,
  company: { id: string; name: string; subdomain: string | null; office_email: string | null },
  member: { id: string; first_name: string; email: string | null },
  unit: string,
  invitedBy: string | null,
) {
  const { token, hash } = newToken();
  await db.from("application_member").update({ token_hash: hash, invited_at: new Date().toISOString() }).eq("id", member.id).eq("company_id", company.id);
  const url = companyUrl(company.subdomain ?? "", ROOT_DOMAIN, `/apply/m/${token}`);
  let emailed = false;
  if (member.email) {
    const content = {
      preheader: `Your rental application for ${unit}.`,
      heading: `Apply for ${unit}`,
      paragraphs: [
        `Hi ${escapeHtml(member.first_name)},`,
        `${invitedBy ? `${escapeHtml(invitedBy)} invited you` : "You're invited"} to apply for ${escapeHtml(unit)} with ${escapeHtml(company.name)}. It takes about 10 minutes on your phone.`,
        "Every adult who will live there (18 or older) fills out their own application. The screening company will ask for your Social Security number directly; we never store it.",
      ],
      button: { label: "Start my application", url },
      note: "This link is just for you. Don't forward it.",
      fromLine: company.name,
    };
    emailed = await sendEmail({ to: member.email, subject: `Your rental application: ${unit}`, html: emailHtml(content), text: emailText(content), fromName: company.name, replyTo: company.office_email });
  }
  return { url, emailed };
}

/**
 * FCRA adverse action notice (15 U.S.C. 1681m(a)), with the credit score disclosure when a score was used
 * (1681m(a)(2)). Sent when a consumer report contributed to a decline or a higher deposit.
 */
export function adverseActionText(input: {
  applicant: string;
  company: string;
  unit: string;
  action: "decline" | "higher_deposit";
  depositText?: string;
  agency: { name: string; address: string; phone: string };
  score?: { value: number; date: string } | null;
  reasons: string[];
}) {
  const what =
    input.action === "decline"
      ? `we are unable to approve your application for ${input.unit}`
      : `we can approve your application for ${input.unit} only with a security deposit of ${input.depositText}, which is more than our standard deposit`;
  return [
    `Dear ${input.applicant},`,
    `Thank you for applying with ${input.company}. After reviewing your application, ${what}.`,
    `This decision was based in whole or in part on information in a consumer report from: ${input.agency.name}, ${input.agency.address}, ${input.agency.phone}.`,
    "The consumer reporting agency did not make this decision and cannot tell you why it was made.",
    "You have the right to get a free copy of your report from the agency if you ask within 60 days of this notice, and the right to dispute with the agency the accuracy or completeness of any information in the report.",
    ...(input.score
      ? [
          `Your credit score: ${input.score.value} (range 300 to 850), as of ${input.score.date}, from ${input.agency.name}. Key factors that affected it are listed in your report, which you can get free from the agency.`,
        ]
      : []),
    ...(input.reasons.length ? [`What we considered: ${input.reasons.join(" ")}`] : []),
    `Our rental criteria are the same for every applicant. Questions? Reply to this e-mail or call ${input.company}.`,
  ];
}
