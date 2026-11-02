// Letters and notices: the Florida notices a landlord sends (statutory wording quoted from
// docs/reference/florida-chapter-83-landlord-tenant-2025.html) and the everyday letters. Each template
// takes the lease, company and sender plus a few per-letter answers, and returns paragraphs. Legal
// notices are never sent automatically: a person reviews and sends each one (CLAUDE.md rule 4).

export type LetterInput = { id: string; label: string; kind: "money" | "date" | "text" | "longtext"; hint?: string };

export type LetterContext = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  landlordName: string;
  tenantNames: string;
  premises: string;
  county: string;
  rentCents: number;
  balanceCents: number;
  rentOwedCents: number;
  leaseEnd: string | null;
  today: string;
  senderName: string;
  senderTitle: string;
};

export type LetterTemplate = {
  id: string;
  title: string;
  group: "Florida notices" | "Everyday letters";
  /** Statute section, shown on the letter and in the picker. */
  cite?: string;
  /** Legal notice: delivery method is recorded; e-mail counts only with the 83.505 addendum. */
  legal?: boolean;
  description: string;
  inputs: LetterInput[];
  subject: (c: LetterContext, v: Record<string, string>) => string;
  body: (c: LetterContext, v: Record<string, string>) => string[];
};

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");
const cents = (v: string | undefined) => Math.round(Number((v ?? "").replace(/[$,\s]/g, "")) * 100) || 0;

// ---------- Florida court holidays and the 3-day notice deadline ----------

function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const d = new Date(Date.UTC(year, month, 1));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + shift + (n - 1) * 7));
}
function lastWeekday(year: number, month: number, weekday: number) {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return new Date(Date.UTC(year, month, d.getUTCDate() - ((d.getUTCDay() - weekday + 7) % 7)));
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
function observed(d: Date) {
  const day = d.getUTCDay();
  if (day === 6) return new Date(d.getTime() - 86_400_000);
  if (day === 0) return new Date(d.getTime() + 86_400_000);
  return d;
}

/**
 * Holidays the 3-day notice in 83.56(3) skips ("excluding Saturday, Sunday, and legal holidays"). The company
 * counts the federal holidays (5 U.S.C. 6103), observed on the nearest weekday. The day after Thanksgiving is
 * kept too: it is a Florida legal holiday (s. 110.117) and the clerks close, so dropping it could make the
 * deadline a day short and the notice defective. Each extra excluded day only gives the tenant more time,
 * which keeps the notice valid.
 */
export function courtHolidays(year: number): Set<string> {
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  return new Set(
    [
      observed(new Date(Date.UTC(year, 0, 1))),
      nthWeekday(year, 0, 1, 3), // Martin Luther King Jr. Day
      nthWeekday(year, 1, 1, 3), // Washington's Birthday
      lastWeekday(year, 4, 1), // Memorial Day
      observed(new Date(Date.UTC(year, 5, 19))), // Juneteenth
      observed(new Date(Date.UTC(year, 6, 4))),
      nthWeekday(year, 8, 1, 1), // Labor Day
      nthWeekday(year, 9, 1, 2), // Columbus Day
      observed(new Date(Date.UTC(year, 10, 11))), // Veterans Day
      thanksgiving,
      new Date(thanksgiving.getTime() + 86_400_000), // Day after Thanksgiving (Florida, s. 110.117)
      observed(new Date(Date.UTC(year, 11, 25))),
    ].map(iso),
  );
}

/**
 * Last day to pay under a 3-day notice (83.56(3)): 3 days after delivery, not counting the delivery day,
 * Saturdays, Sundays or court holidays. Mailed notices add 5 days for mailing first (Fla. R. Civ. P. 1.090(e)
 * practice), so many offices hand-deliver or post instead.
 */
export function threeDayDeadline(delivered: string, mailed = false): string {
  let d = new Date(`${delivered}T12:00:00Z`);
  if (mailed) d = new Date(d.getTime() + 5 * 86_400_000);
  let counted = 0;
  while (counted < 3) {
    d = new Date(d.getTime() + 86_400_000);
    const day = d.getUTCDay();
    if (day === 0 || day === 6 || courtHolidays(d.getUTCFullYear()).has(iso(d))) continue;
    counted++;
  }
  return iso(d);
}

/** Last day of the monthly period that ends at least 30 days after notice (83.57(3), as amended 2023). */
export function monthToMonthEnd(noticeDate: string): string {
  const d = new Date(`${noticeDate}T12:00:00Z`);
  const earliest = new Date(d.getTime() + 30 * 86_400_000);
  const end = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + 1, 0));
  return iso(end.getTime() < earliest.getTime() ? new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + 2, 0)) : end);
}

// ---------- templates ----------

const signoff = (c: LetterContext) => [`${c.senderName}${c.senderTitle ? `, ${c.senderTitle}` : ""}`, `${c.companyName}, agent for ${c.landlordName}`, [c.companyAddress, c.companyPhone].filter(Boolean).join(" · ")];

export const LETTERS: LetterTemplate[] = [
  {
    id: "three-day",
    title: "3-day notice to pay rent or deliver possession",
    group: "Florida notices",
    cite: "Fla. Stat. 83.56(3)",
    legal: true,
    description: "Rent only (no late fees or other charges). The deadline skips weekends and federal holidays.",
    inputs: [
      { id: "amount", label: "Rent owed ($)", kind: "money", hint: "Rent only. Don't include late fees, utilities or other charges." },
      { id: "delivered", label: "Date it will be delivered", kind: "date" },
    ],
    subject: () => "Three-day notice to pay rent or deliver possession",
    body: (c, v) => {
      const deadline = threeDayDeadline(v.delivered || c.today);
      return [
        `To: ${c.tenantNames}`,
        `You are hereby notified that you are indebted to me in the sum of ${money(cents(v.amount))} dollars for the rent and use of the premises ${c.premises}, ${c.county} County, Florida, now occupied by you and that I demand payment of the rent or possession of the premises within 3 days (excluding Saturday, Sunday, and legal holidays) from the date of delivery of this notice, to wit: on or before the ${longDate(deadline)}.`,
        `${c.landlordName}, by its agent ${c.companyName}, ${c.companyAddress}${c.companyPhone ? `, ${c.companyPhone}` : ""}`,
        ...signoff(c),
      ];
    },
  },
  {
    id: "seven-day-cure",
    title: "7-day notice of noncompliance (with chance to fix)",
    group: "Florida notices",
    cite: "Fla. Stat. 83.56(2)(b)",
    legal: true,
    description: "For problems the tenant can correct: unauthorized pets, guests or vehicles, parking, cleanliness.",
    inputs: [{ id: "noncompliance", label: "What the tenant is doing wrong", kind: "longtext", hint: "Be specific: what, where, and the lease section." }],
    subject: () => "Seven-day notice of noncompliance",
    body: (c, v) => [
      `To: ${c.tenantNames}, ${c.premises}`,
      `You are hereby notified that ${v.noncompliance || "(cite the noncompliance)"}. Demand is hereby made that you remedy the noncompliance within 7 days of receipt of this notice or your lease shall be deemed terminated and you shall vacate the premises upon such termination. If this same conduct or conduct of a similar nature is repeated within 12 months, your tenancy is subject to termination without further warning and without your being given an opportunity to cure the noncompliance.`,
      ...signoff(c),
    ],
  },
  {
    id: "seven-day-no-cure",
    title: "7-day notice of termination (no chance to fix)",
    group: "Florida notices",
    cite: "Fla. Stat. 83.56(2)(a)",
    legal: true,
    description: "Only for serious problems (intentional damage, continued disturbance) or a repeat within 12 months of a written warning.",
    inputs: [{ id: "noncompliance", label: "Why the lease is being ended", kind: "longtext", hint: "Cite the specific noncompliance and dates." }],
    subject: () => "Notice of termination",
    body: (c, v) => [
      `To: ${c.tenantNames}, ${c.premises}`,
      `You are advised that your lease is terminated effective immediately. You shall have 7 days from the delivery of this letter to vacate the premises. This action is taken because ${v.noncompliance || "(cite the noncompliance)"}.`,
      ...signoff(c),
    ],
  },
  {
    id: "deposit-claim",
    title: "Notice of intent to claim on the security deposit",
    group: "Florida notices",
    cite: "Fla. Stat. 83.49(3)(a)",
    legal: true,
    description: "Send by certified mail within 30 days after the tenant moves out, or return the deposit in full within 15 days.",
    inputs: [
      { id: "amount", label: "Amount claimed ($)", kind: "money" },
      { id: "reason", label: "Why (each charge)", kind: "longtext", hint: "List each deduction and its cost." },
    ],
    subject: () => "Notice of intention to impose claim on security deposit",
    body: (c, v) => [
      `To: ${c.tenantNames}`,
      `This is a notice of my intention to impose a claim for damages in the amount of ${money(cents(v.amount))} upon your security deposit, due to ${v.reason || "(reason)"}. It is sent to you as required by s. 83.49(3), Florida Statutes. You are hereby notified that you must object in writing to this deduction from your security deposit within 15 days after the time you receive this notice or I will be authorized to deduct my claim from your security deposit. Your objection must be sent to ${c.companyAddress}.`,
      ...signoff(c),
    ],
  },
  {
    id: "month-to-month-end",
    title: "Notice ending a month-to-month tenancy",
    group: "Florida notices",
    cite: "Fla. Stat. 83.57(3)",
    legal: true,
    description: "At least 30 days before the end of a monthly period.",
    inputs: [{ id: "delivered", label: "Date it will be delivered", kind: "date" }],
    subject: () => "Notice of termination of month-to-month tenancy",
    body: (c, v) => {
      const end = monthToMonthEnd(v.delivered || c.today);
      return [
        `To: ${c.tenantNames}, ${c.premises}`,
        `This is written notice under section 83.57(3), Florida Statutes, that your month-to-month tenancy will end on ${longDate(end)}. Please move out and return all keys by that date. Rent is due as usual through that date.`,
        "We'll inspect the home after you move out and handle your security deposit as section 83.49 requires. Please give us your forwarding address in writing.",
        ...signoff(c),
      ];
    },
  },
  {
    id: "non-renewal",
    title: "Notice of non-renewal at lease end",
    group: "Florida notices",
    cite: "Fla. Stat. 83.575",
    legal: true,
    description: "Tells the tenant the lease won't renew. Give at least the notice period in the lease (no more than 60 days).",
    inputs: [],
    subject: () => "Notice of non-renewal",
    body: (c) => [
      `To: ${c.tenantNames}, ${c.premises}`,
      `This is written notice that your lease will not be renewed and will end on ${c.leaseEnd ? longDate(c.leaseEnd) : "(lease end date)"}. Please move out and return all keys by that date.`,
      "We'll inspect the home after you move out and handle your security deposit as section 83.49, Florida Statutes, requires. Please give us your forwarding address in writing.",
      ...signoff(c),
    ],
  },
  {
    id: "end-of-term-reminder",
    title: "Reminder of your end-of-term notice duty",
    group: "Florida notices",
    cite: "Fla. Stat. 83.575(2)",
    legal: true,
    description: "Send within the 15 days before the tenant's notice period starts. Without it, liquidated damages for leaving without notice can't be charged.",
    inputs: [
      { id: "notice_days", label: "Notice days in the lease", kind: "text", hint: "60" },
      { id: "ld_amount", label: "Liquidated damages ($)", kind: "money", hint: "The amount in the lease. Leave blank for one month's rent." },
    ],
    subject: () => "Your lease end date and notice requirement",
    body: (c, v) => {
      const days = Number(v.notice_days) || 60;
      const end = c.leaseEnd;
      const by = end ? longDate(new Date(Date.parse(`${end}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)) : "(date)";
      return [
        `To: ${c.tenantNames}, ${c.premises}`,
        `This is written notice under section 83.575(2), Florida Statutes. Your lease ends on ${end ? longDate(end) : "(lease end date)"}.`,
        `Your lease requires you to give us written notice at least ${days} days before the lease ends if you do not plan to renew, which means by ${by}.`,
        `If you move out at the end of the lease without giving that notice, you may owe liquidated damages of ${money(cents(v.ld_amount) || c.rentCents)}. There are no other fees, penalties or charges for not giving this notice. Rent and any other amounts you owe under the lease still apply as usual.`,
        "If you'd like to renew, just let us know.",
        ...signoff(c),
      ];
    },
  },
  {
    id: "entry",
    title: "Notice of entry for repairs",
    group: "Florida notices",
    cite: "Fla. Stat. 83.53(2)",
    legal: true,
    description: "At least 24 hours before entry, for entry between 7:30 a.m. and 8:00 p.m.",
    inputs: [
      { id: "when", label: "Date and time window", kind: "text", hint: "e.g. Tuesday, November 3, between 9:00 a.m. and 12:00 p.m." },
      { id: "purpose", label: "Why", kind: "text", hint: "e.g. to repair the air conditioner" },
    ],
    subject: () => "Notice of entry",
    body: (c, v) => [
      `To: ${c.tenantNames}, ${c.premises}`,
      `This is your notice under section 83.53, Florida Statutes, that the landlord or its contractor will enter the premises on ${v.when || "(date and time)"} ${v.purpose || "to make repairs"}. You don't need to be home. Please secure pets.`,
      ...signoff(c),
    ],
  },
  // ---------- everyday letters ----------
  {
    id: "rent-reminder",
    title: "Rent reminder",
    group: "Everyday letters",
    description: "Friendly reminder before rent is due.",
    inputs: [],
    subject: () => "Rent reminder",
    body: (c) => [`Hi ${c.tenantNames},`, `A friendly reminder that rent of ${money(c.rentCents)} is due on the 1st. You can pay from your tenant portal. Thank you!`, ...signoff(c)],
  },
  {
    id: "past-due",
    title: "Past-due balance (courtesy notice)",
    group: "Everyday letters",
    description: "Not a legal notice. Use the 3-day notice to start the legal process.",
    inputs: [],
    subject: () => "Your account is past due",
    body: (c) => [
      `Hi ${c.tenantNames},`,
      `Our records show a past-due balance of ${money(c.balanceCents)} on your account for ${c.premises}. Please pay it as soon as possible from your tenant portal, or call us if there's a problem so we can talk about it.`,
      ...signoff(c),
    ],
  },
  {
    id: "renewal-offer",
    title: "Lease renewal offer",
    group: "Everyday letters",
    description: "Offer to renew, with the new rent and term.",
    inputs: [
      { id: "rent", label: "New monthly rent ($)", kind: "money" },
      { id: "term", label: "Term", kind: "text", hint: "e.g. 12 months" },
      { id: "reply_by", label: "Reply by", kind: "date" },
    ],
    subject: () => "Your lease renewal offer",
    body: (c, v) => [
      `Hi ${c.tenantNames},`,
      `Your lease at ${c.premises} ends ${c.leaseEnd ? longDate(c.leaseEnd) : "soon"}. We'd love for you to stay! We're offering a ${v.term || "12-month"} renewal at ${money(cents(v.rent) || c.rentCents)} a month.`,
      `Please let us know by ${v.reply_by ? longDate(v.reply_by) : "the date above"} whether you'd like to renew, and we'll send the renewal to sign.`,
      ...signoff(c),
    ],
  },
  {
    id: "welcome",
    title: "Welcome letter",
    group: "Everyday letters",
    description: "For a new tenant: portal, rent, repairs and insurance.",
    inputs: [],
    subject: (c) => `Welcome to ${c.premises}`,
    body: (c) => [
      `Welcome, ${c.tenantNames}!`,
      `We're glad to have you at ${c.premises}. Rent of ${money(c.rentCents)} is due on the 1st of each month. Your tenant portal is where you pay rent, request repairs (with photos), and message us.`,
      "For anything dangerous (a gas smell, smoke, fire or sparks), leave and call 911 first, then report it in the portal. Please keep your renters insurance current and upload proof in the portal.",
      ...signoff(c),
    ],
  },
  {
    id: "move-out",
    title: "Move-out instructions",
    group: "Everyday letters",
    description: "After a tenant gives notice.",
    inputs: [{ id: "date", label: "Move-out date", kind: "date" }],
    subject: () => "Move-out instructions",
    body: (c, v) => [
      `Hi ${c.tenantNames},`,
      `We've received your notice to move out of ${c.premises} on ${v.date ? longDate(v.date) : "(date)"}. To get your full deposit back: clean the home, remove all belongings and trash, replace burned-out bulbs, and return all keys, remotes and access devices to the office.`,
      "Please send us your forwarding address in writing. We'll inspect after you move out and handle your deposit as section 83.49, Florida Statutes, requires.",
      ...signoff(c),
    ],
  },
  {
    id: "insurance",
    title: "Renters insurance needed",
    group: "Everyday letters",
    description: "Ask for current proof of renters insurance.",
    inputs: [],
    subject: () => "Please send proof of renters insurance",
    body: (c) => [`Hi ${c.tenantNames},`, `Your lease requires renters insurance, and we don't have current proof on file. Please upload your declarations page in your tenant portal, with ${c.companyName} listed as an interested party.`, ...signoff(c)],
  },
  {
    id: "rent-increase",
    title: "Rent change at renewal",
    group: "Everyday letters",
    description: "New rent for the next term (a fixed-term lease's rent can't change mid-term).",
    inputs: [
      { id: "rent", label: "New monthly rent ($)", kind: "money" },
      { id: "starts", label: "Starting", kind: "date" },
    ],
    subject: () => "Your rent for the next term",
    body: (c, v) => [`Hi ${c.tenantNames},`, `Starting ${v.starts ? longDate(v.starts) : "(date)"}, rent for ${c.premises} will be ${money(cents(v.rent))} a month. Everything else about your lease stays the same. Call us with any questions.`, ...signoff(c)],
  },
  {
    id: "violation-warning",
    title: "Friendly lease reminder",
    group: "Everyday letters",
    description: "A first, informal reminder. For a formal notice use the 7-day notice.",
    inputs: [{ id: "issue", label: "What to fix", kind: "longtext" }],
    subject: () => "A reminder about your lease",
    body: (c, v) => [`Hi ${c.tenantNames},`, `We noticed ${v.issue || "(describe the issue)"}. Please take care of it within the next few days. If it continues, we'll need to send a formal notice under your lease. Thanks for your help!`, ...signoff(c)],
  },
  {
    id: "pest-inspection",
    title: "Pest treatment or inspection",
    group: "Everyday letters",
    description: "Heads-up for a scheduled treatment or inspection (still give the 24-hour entry notice).",
    inputs: [{ id: "when", label: "Date and time window", kind: "text" }],
    subject: () => "Scheduled visit to your home",
    body: (c, v) => [`Hi ${c.tenantNames},`, `We've scheduled a visit to ${c.premises} on ${v.when || "(date and time)"}. Please secure pets and clear access to the kitchen and bathrooms. You don't need to be home.`, ...signoff(c)],
  },
];

export const DELIVERY_LABEL: Record<string, string> = { email: "E-mail", portal: "Portal", posted: "Posted on the door", hand_delivered: "Hand-delivered", mail: "Mailed", certified_mail: "Certified mail", print: "Printed" };

export const letterById = (id: string) => LETTERS.find((l) => l.id === id);
